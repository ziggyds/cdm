# CDM Container Database Manager
 A small app that can spin up different types of database on a host on the fly.
 Which databases are available is configured in the db_configs.json.
 You can mount a custom one if the default one doesn't suit your needs.
 It needs the docker socket to be able to start and stop containers or use a docker socket proxy.

 Compose file included to easily run the app.
 Or 
   docker run --name ddm -d -v /var/run/docker.sock:/var/run/docker.sock -p 5000:5000 ziggyds/ddm:latest

 Docker build

    docker build -f docker/Dockerfile -t cdm:latest -t cdm:v0.0.1 .