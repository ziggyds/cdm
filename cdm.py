from flask import Flask, request, jsonify, send_from_directory
import os
import json
import docker
import requests  # Add this import for making HTTP requests to Docker Hub

app = Flask(__name__)
client = docker.from_env()

# Directory to store container metadata and pull database configurations from
CONTAINER_DIR = './containers'
DB_CONFIG_FILE = './db_configs.json'

os.makedirs(CONTAINER_DIR, exist_ok=True)

# Load database configurations
with open(DB_CONFIG_FILE, 'r') as f:
    db_configs = json.load(f)

# Serve the web UI
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/db-types', methods=['GET'])
def get_db_types():
    try:
        # Return the keys (database types) from db_configs.json
        db_types = list(db_configs.keys())
        return jsonify(db_types)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Create a new database container
@app.route('/create', methods=['POST'])
def create_container():
    data = request.json
    db_type = data.get('type')
    instance_name = data.get('name')
    db_user = data.get('user', 'default_user')
    db_password = data.get('password', 'default_password')
    port = data.get('port')  # Get the port from the request, if provided

    if db_type not in db_configs:
        return jsonify({"error": "Unsupported database type"}), 400

    # Get database-specific configuration
    db_config = db_configs[db_type]
    env_vars = {var: value for var, value in zip(db_config['env_vars'], [db_user, db_password])}
    port_mapping = {f"{db_config['default_port']}/tcp": port} if port else {f"{db_config['default_port']}/tcp": None}

    # Create a new Docker container
    container = client.containers.run(
        db_config['image'],
        name=instance_name,
        environment=env_vars,
        ports=port_mapping,
        detach=True
    )

    # Save container metadata
    container_info = {
        "id": container.id,
        "name": instance_name,
        "type": db_type,
        "ports": container.attrs['NetworkSettings']['Ports'],
        "user": db_user,
    }
    metadata_file = os.path.join(CONTAINER_DIR, f"{instance_name}.json")
    with open(metadata_file, 'w') as f:
        json.dump(container_info, f, indent=4)

    return jsonify({"status": "Container created", "info": container_info})

# List all containers
@app.route('/list', methods=['GET'])
def list_containers():
    try:
        containers = []
        # Get the list of valid database images from db_configs
        valid_images = {config['image'].split(':')[0] for config in db_configs.values()}

        # Iterate through all Docker containers
        for container in client.containers.list(all=True):  # Fetch all containers (running and stopped)
            # Extract container image name without tag
            container_image = container.image.tags[0].split(':')[0] if container.image.tags else ""
            
            # Check if the container's image matches any of the valid database images
            if container_image in valid_images:
                containers.append({
                    "id": container.id,
                    "name": container.name,
                    "type": next((db_type for db_type, config in db_configs.items() 
                                if config['image'].split(':')[0] == container_image), "unknown"),
                    "status": container.status,
                    "ports": container.attrs['NetworkSettings']['Ports']
                })

        return jsonify(containers)
    except Exception as e:
        app.logger.error(f"Error listing containers: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Stop and remove a container
@app.route('/remove/<name>', methods=['DELETE'])
def remove_container(name):
    try:
        # Stop and remove the container
        container = client.containers.get(name)
        container.stop()
        container.remove()

        # Delete the metadata file
        metadata_file = os.path.join(CONTAINER_DIR, f"{name}.json")
        os.remove(metadata_file)

        return jsonify({"status": f"Container {name} removed"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# Fetch tags for a specific database type from Docker Hub
@app.route('/tags/<db_type>', methods=['GET'])
def get_docker_tags(db_type):
    # Check if the database type exists in the configuration
    if db_type not in db_configs:
        return jsonify({"error": "Unsupported database type"}), 400

    # Get the Docker Hub repository URL from the configuration
    repo = db_configs[db_type].get('repo')
    if not repo:
        return jsonify({"error": f"No repository URL found for database type {db_type}"}), 400

    # Construct the Docker Hub API URL
    url = f"https://registry.hub.docker.com/v2/repositories/{repo}/tags?page_size=50"

    try:
        # Fetch tags from Docker Hub
        response = requests.get(url)
        response.raise_for_status()
        tags = [result["name"] for result in response.json()["results"]]
        return jsonify(tags)
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    host = os.getenv('DDM_HOST', '0.0.0.0')
    app.run(host=host, port=5000)