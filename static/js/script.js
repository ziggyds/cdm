document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("create-container-form");
    const containerList = document.getElementById("container-list");
    const dbTypeSelect = document.getElementById("dbType");
    const tagSelect = document.getElementById("tag");

    // Fetch database types from the backend
    async function loadDbTypes() {
        try {
            const response = await fetch("/db-types");
            if (!response.ok) {
                throw new Error("Failed to fetch database types");
            }

            const dbTypes = await response.json();
            dbTypeSelect.innerHTML = ""; // Clear existing options

            dbTypes.forEach((dbType, index) => {
                const option = document.createElement("option");
                option.value = dbType;
                option.textContent = dbType.charAt(0).toUpperCase() + dbType.slice(1);
                if (index === 0) {
                    option.selected = true; // Set the first database type as the default
                }
                dbTypeSelect.appendChild(option);
            });

            // Trigger tag loading for the first database type
            if (dbTypes.length > 0) {
                dbTypeSelect.dispatchEvent(new Event("change"));
            }
        } catch (error) {
            console.error("Error loading database types:", error);
            document.getElementById("status").innerText = "Error loading database types.";
        }
    }

    // Fetch tags from Docker Hub for a specific database type
    async function fetchTags(dbType) {
        try {
            const response = await fetch(`/tags/${dbType}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch tags for ${dbType}`);
            }

            const tags = await response.json();
            return tags;
        } catch (error) {
            console.error(`Error fetching tags for ${dbType}:`, error);
            return [];
        }
    }

    // Populate the tag dropdown based on the selected database type
    async function populateTagDropdown(dbType) {
        $(tagSelect).empty(); // Clear existing options

        const tags = await fetchTags(dbType);

        tags.forEach((tag, index) => {
            const option = new Option(tag, tag);
            if (index === 0) {
                option.selected = true; // Set the first tag as the default
            }
            $(tagSelect).append(option);
        });

        // Refresh Select2 to reflect the new options
        $(tagSelect).trigger("change");
    }

    // Trigger tag dropdown update when the database type changes
    dbTypeSelect.addEventListener("change", async () => {
        const selectedDbType = dbTypeSelect.value;
        if (selectedDbType) {
            await populateTagDropdown(selectedDbType);
        } else {
            $(tagSelect).empty(); // Clear the tag dropdown if no database type is selected
        }
    });

    // Handle form submission to create a new container
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const data = {
            type: formData.get("type"),
            tag: formData.get("tag"),
            name: formData.get("name"),
            user: formData.get("user"),
            password: formData.get("password"),
            port: formData.get("port") || null, // Use null if no port is provided
        };

        try {
            const response = await fetch("/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                document.getElementById("status").innerText = `Container created: ${result.info.name}`;
                loadContainers();
            } else {
                document.getElementById("status").innerText = `Error: ${result.error}`;
            }
        } catch (error) {
            document.getElementById("status").innerText = `Error: ${error.message}`;
        }
    });

    // Fetch and display existing containers
    async function loadContainers() {
        try {
            const response = await fetch("/list");
            const containers = await response.json();

            containerList.innerHTML = "";
            
            if (containers.length === 0) {
                containerList.innerHTML = '<div class="empty-state">No containers found</div>';
                return;
            }

            containers.forEach((container) => {
                // Format ports for display
                let portsHtml = '';
                if (container.ports) {
                    Object.entries(container.ports).forEach(([portKey, portValue]) => {
                        if (portValue && portValue.length > 0) {
                            portValue.forEach(mapping => {
                                portsHtml += `<span class="port-tag">${mapping.HostIp}:${mapping.HostPort} → ${portKey}</span>`;
                            });
                        } else {
                            portsHtml += `<span class="port-tag">${portKey} (not mapped)</span>`;
                        }
                    });
                }
                
                const card = document.createElement('div');
                card.className = 'container-card';
                
                // Status badge class based on container status
                const statusClass = container.status === 'running' ? 'status-running' : 'status-exited';
                
                card.innerHTML = `
                    <div class="container-header">
                        <h3 class="container-name">${container.name}</h3>
                        <span class="status-badge ${statusClass}">${container.status}</span>
                    </div>
                    <div class="container-body">
                        <div class="container-info">
                            <div class="info-label">Type</div>
                            <div>${container.type}</div>
                        </div>
                        <div class="container-info">
                            <div class="info-label">ID</div>
                            <div>${container.id.substring(0, 12)}...</div>
                        </div>
                        <div class="container-info">
                            <div class="info-label">Ports</div>
                            <div class="port-mapping">
                                ${portsHtml || 'No ports mapped'}
                            </div>
                        </div>
                        <div class="container-actions">
                            <button class="btn-remove" onclick="removeContainer('${container.name}')">Remove</button>
                        </div>
                    </div>
                `;
                containerList.appendChild(card);
            });
        } catch (error) {
            console.error("Error loading containers:", error);
            containerList.innerHTML = `<div class="error-message">Error loading containers: ${error.message}</div>`;
        }
    }
    
    // Function to remove a container
    window.removeContainer = async (name) => {
        try {
            const response = await fetch(`/remove/${name}`, { method: "DELETE" });
            const result = await response.json();
    
            if (response.ok) {
                alert(result.status);
                loadContainers();
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            console.error("Error removing container:", error);
            alert("An error occurred while removing the container.");
        }
    };

    // Load database types and containers on page load
    (async () => {
        await loadDbTypes();
        loadContainers();
    })();
});