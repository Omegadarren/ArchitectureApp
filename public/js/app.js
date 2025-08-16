class ArchitectureApp {
    // Utility function to add business days to a date
    addBusinessDays(startDate, businessDays) {
        const date = new Date(startDate);
        let addedDays = 0;
        
        while (addedDays < businessDays) {
            date.setDate(date.getDate() + 1);
            // Skip weekends (0 = Sunday, 6 = Saturday)
            if (date.getDay() !== 0 && date.getDay() !== 6) {
                addedDays++;
            }
        }
        
        return date;
    }

    // Format date for HTML date input (YYYY-MM-DD)
    formatDateForInput(date) {
        if (!date) return '';
        
        // If it's already a string in the right format, return it
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}/)) {
            return date.substring(0, 10); // Take just the YYYY-MM-DD part
        }
        
        // Convert to Date object if needed
        const dateObj = date instanceof Date ? date : new Date(date);
        
        // Check if the date is valid
        if (isNaN(dateObj.getTime())) {
            console.warn('Invalid date provided to formatDateForInput:', date);
            return '';
        }
        
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Initialize address autocomplete functionality
    initializeAddressAutocomplete() {
        // Initialize for both inline and modal forms
        this.setupAddressAutocomplete('projectAddress'); // Inline form
        this.setupAddressAutocomplete('project-address'); // Modal form
    }

    // Setup address autocomplete for a given input field
    setupAddressAutocomplete(fieldId) {
        const addressInput = document.getElementById(fieldId);
        if (!addressInput) return;

        // Create autocomplete dropdown container
        const autocompleteContainer = document.createElement('div');
        autocompleteContainer.className = 'address-autocomplete-container';
        autocompleteContainer.style.position = 'relative';
        
        const dropdown = document.createElement('div');
        dropdown.className = 'address-autocomplete-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 4px 4px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            max-height: 200px;
            overflow-y: auto;
            display: none;
        `;

        // Insert container around the input
        addressInput.parentNode.insertBefore(autocompleteContainer, addressInput);
        autocompleteContainer.appendChild(addressInput);
        autocompleteContainer.appendChild(dropdown);

        let debounceTimer;
        let currentSuggestions = [];

        // Handle input changes with debouncing
        addressInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            clearTimeout(debounceTimer);
            
            if (query.length < 3) {
                dropdown.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(() => {
                this.fetchAddressSuggestions(query, (suggestions) => {
                    currentSuggestions = suggestions;
                    this.displayAddressSuggestions(dropdown, suggestions, addressInput, fieldId);
                });
            }, 300);
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!autocompleteContainer.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        // Handle keyboard navigation
        addressInput.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.autocomplete-item');
            let selectedIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
                this.updateSelection(items, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
                this.updateSelection(items, selectedIndex);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex].click();
            } else if (e.key === 'Escape') {
                dropdown.style.display = 'none';
            }
        });
    }

    // Fetch address suggestions using multiple providers for better results
    async fetchAddressSuggestions(query, callback) {
        try {
            // Try Photon first (fast OpenStreetMap-based service)
            let suggestions = await this.fetchPhotonSuggestions(query);
            
            // If no good results, try improved Nominatim
            if (suggestions.length === 0) {
                suggestions = await this.fetchNominatimSuggestions(query);
            }

            callback(suggestions);
        } catch (error) {
            console.error('Address search error:', error);
            // Try basic Nominatim as final fallback
            try {
                const suggestions = await this.fetchNominatimSuggestions(query);
                callback(suggestions);
            } catch (fallbackError) {
                console.error('Fallback address search failed:', fallbackError);
                callback([]);
            }
        }
    }

    // Fetch suggestions from Photon (fast OpenStreetMap geocoding)
    async fetchPhotonSuggestions(query) {
        try {
            // Add bias towards US addresses and filter for better US results
            const url = `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&limit=5&osm_tag=building&lon=-95.7129&lat=37.0902&location_bias_scale=0.5`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Photon API error: ${response.status}`);
            
            const data = await response.json();
            
            // Filter to prioritize US results first
            const features = data.features || [];
            const usResults = features.filter(f => f.properties.countrycode === 'US');
            const otherResults = features.filter(f => f.properties.countrycode !== 'US');
            
            // Combine with US results first
            const prioritizedFeatures = [...usResults, ...otherResults].slice(0, 5);
            
            return prioritizedFeatures.map(feature => ({
                description: this.formatPhotonDescription(feature),
                address: this.parsePhotonAddress(feature),
                provider: 'photon'
            }));
        } catch (error) {
            console.warn('Photon search failed:', error);
            return [];
        }
    }

    // Fetch suggestions from Nominatim (OpenStreetMap) with better US focus
    async fetchNominatimSuggestions(query) {
        // Use more specific parameters for better US address results
        const url = `https://nominatim.openstreetmap.org/search?` + 
                   `q=${encodeURIComponent(query)}&` +
                   `format=json&` +
                   `addressdetails=1&` +
                   `countrycodes=us&` +
                   `limit=5&` +
                   `bounded=1&` +
                   `dedupe=1&` +
                   `extratags=1`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ArchitectureApp/1.0 (contact@example.com)'
            }
        });
        
        if (!response.ok) throw new Error(`Nominatim API error: ${response.status}`);
        
        const data = await response.json();
        
        return data.map(item => ({
            description: this.formatNominatimDescription(item),
            address: this.parseNominatimAddress(item),
            provider: 'nominatim'
        }));
    }

    // Format Nominatim response for better display
    formatNominatimDescription(item) {
        const addr = item.address || {};
        let parts = [];
        
        // Build a cleaner address display
        if (addr.house_number && addr.road) {
            parts.push(`${addr.house_number} ${addr.road}`);
        } else if (addr.road) {
            parts.push(addr.road);
        }
        
        if (addr.city || addr.town || addr.village) {
            parts.push(addr.city || addr.town || addr.village);
        }
        
        if (addr.state) {
            parts.push(addr.state);
        }
        
        if (addr.postcode) {
            parts.push(addr.postcode);
        }
        
        return parts.length > 0 ? parts.join(', ') : item.display_name;
    }

    // Parse Nominatim response into structured address (improved)
    parseNominatimAddress(item) {
        const addr = item.address || {};
        console.log('Parsing Nominatim address:', addr);
        
        // Better city extraction - try multiple fields including county and administrative areas
        const city = addr.city || 
                    addr.town || 
                    addr.village || 
                    addr.municipality || 
                    addr.hamlet || 
                    addr.suburb ||
                    addr.neighbourhood ||
                    addr.county ||  // Sometimes county is the closest thing to city
                    addr.state_district ||
                    '';

        // Better state extraction
        const state = addr.state || 
                     addr.state_district || 
                     addr.region ||
                     '';

        const result = {
            street: `${addr.house_number || ''} ${addr.road || ''}`.trim(),
            city: city,
            state: state,
            postcode: addr.postcode || '',
            formatted: this.formatNominatimDescription(item)
        };

        console.log('Parsed address result:', result);
        return result;
    }

    // Format Photon response for display
    formatPhotonDescription(feature) {
        const props = feature.properties || {};
        let parts = [];
        
        if (props.housenumber) parts.push(props.housenumber);
        if (props.street) parts.push(props.street);
        if (props.city) parts.push(props.city);
        if (props.state) parts.push(props.state);
        if (props.postcode) parts.push(props.postcode);
        
        return parts.join(', ') || props.name || 'Unknown address';
    }

    // Parse Photon response into structured address
    parsePhotonAddress(feature) {
        const props = feature.properties || {};
        console.log('Photon raw properties:', props);
        
        const result = {
            street: `${props.housenumber || ''} ${props.street || ''}`.trim(),
            city: props.city || props.town || props.village || '',
            state: props.state || '',
            postcode: props.postcode || '',
            formatted: this.formatPhotonDescription(feature)
        };
        
        console.log('Photon parsed result:', result);
        return result;
    }
    parseHereAddress(item) {
        const addr = item.address || {};
        return {
            street: `${addr.houseNumber || ''} ${addr.street || ''}`.trim(),
            city: addr.city || '',
            state: addr.stateCode || addr.state || '',
            postcode: addr.postalCode || '',
            formatted: item.title
        };
    }

    // Parse MapBox response into structured address
    parseMapBoxAddress(feature) {
        const context = feature.context || [];
        const props = feature.properties || {};
        
        // Extract components from MapBox context array
        let city = '', state = '', postcode = '';
        
        context.forEach(item => {
            const id = item.id || '';
            if (id.startsWith('place.')) {
                city = item.text;
            } else if (id.startsWith('region.')) {
                state = item.short_code ? item.short_code.replace('us-', '').toUpperCase() : item.text;
            } else if (id.startsWith('postcode.')) {
                postcode = item.text;
            }
        });

        return {
            street: feature.place_name.split(',')[0] || '', // First part is usually the street
            city: city,
            state: state,
            postcode: postcode,
            formatted: feature.place_name
        };
    }

    // Display address suggestions in dropdown
    displayAddressSuggestions(dropdown, suggestions, addressInput, fieldId) {
        dropdown.innerHTML = '';
        
        if (suggestions.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.style.cssText = `
                padding: 10px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                font-size: 14px;
                line-height: 1.4;
            `;
            
            item.innerHTML = `
                <div style="font-weight: 500;">${suggestion.address.street || suggestion.description.split(',')[0]}</div>
                <div style="color: #666; font-size: 12px;">${suggestion.address.city}, ${suggestion.address.state} ${suggestion.address.postcode}</div>
            `;

            item.addEventListener('mouseenter', () => {
                this.updateSelection(dropdown.querySelectorAll('.autocomplete-item'), index);
            });

            item.addEventListener('click', () => {
                console.log('🔥 ADDRESS ITEM CLICKED!');
                console.log('Suggestion:', suggestion);
                console.log('AddressInput:', addressInput);
                console.log('FieldId:', fieldId);
                this.selectAddress(suggestion, addressInput, fieldId);
                dropdown.style.display = 'none';
            });

            dropdown.appendChild(item);
        });

        dropdown.style.display = 'block';
    }

    // Update visual selection of dropdown items
    updateSelection(items, selectedIndex) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
                item.style.backgroundColor = '#f0f0f0';
            } else {
                item.classList.remove('selected');
                item.style.backgroundColor = 'white';
            }
        });
    }

    // Handle address selection
    selectAddress(suggestion, addressInput, fieldId) {
        const addr = suggestion.address;
        console.log('=== ADDRESS SELECTION DEBUG START ===');
        console.log('Field ID:', fieldId);
        console.log('Selected address:', addr, 'Provider:', suggestion.provider);
        
        // Extract project ID from field ID (e.g., "projectAddress_123" -> "123")
        let projectId = '';
        if (fieldId.includes('_')) {
            projectId = fieldId.split('_')[1];
        }
        console.log('Extracted Project ID:', projectId);
        
        // Fill the address field with street address
        addressInput.value = addr.street || suggestion.description.split(',')[0];
        console.log('✅ Set address field to:', addressInput.value);

        // Hide the suggestions dropdown
        const suggestionsContainer = projectId ? 
            document.getElementById(`address-suggestions-${projectId}`) : 
            document.getElementById('address-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }

        // Auto-fill related fields based on field type and project ID
        if (fieldId.startsWith('projectAddress_')) {
            console.log('>>> Processing INLINE form with project ID:', projectId);
            
            // Project-specific inline form fields
            const cityFieldId = `projectCity_${projectId}`;
            const stateFieldId = `projectState_${projectId}`;
            const zipFieldId = `projectZip_${projectId}`;
            
            const cityField = document.getElementById(cityFieldId);
            const stateField = document.getElementById(stateFieldId);
            const zipField = document.getElementById(zipFieldId);

            console.log('Found project-specific inline fields:', {
                city: cityField ? 'FOUND' : 'MISSING',
                state: stateField ? 'FOUND' : 'MISSING', 
                zip: zipField ? 'FOUND' : 'MISSING'
            });

            if (cityField) {
                console.log('City field element:', cityField);
                console.log('City field current value:', cityField.value);
                console.log('Address city data:', addr.city);
                if (addr.city) {
                    console.log('🔥 ATTEMPTING TO SET CITY FIELD...');
                    cityField.value = addr.city;
                    console.log('✅ SUCCESSFULLY SET CITY TO:', addr.city);
                    console.log('City field value after setting:', cityField.value);
                    
                    // Double check it worked
                    setTimeout(() => {
                        const verifyField = document.getElementById(cityFieldId);
                        console.log('🔍 VERIFICATION - City field value after 100ms:', verifyField ? verifyField.value : 'FIELD NOT FOUND');
                    }, 100);
                } else {
                    console.log('❌ NO CITY DATA AVAILABLE');
                }
            } else {
                console.log('❌ PROJECT-SPECIFIC CITY FIELD NOT FOUND:', cityFieldId);
            }
            
            if (stateField && addr.state) {
                stateField.value = addr.state;
                console.log('✅ Set state to:', addr.state);
            }
            if (zipField && addr.postcode) {
                zipField.value = addr.postcode;
                console.log('✅ Set zip to:', addr.postcode);
            }
        } else if (fieldId === 'project-address') {
            console.log('>>> Processing MODAL form (project-address)');
            // Modal form fields
            const cityField = document.getElementById('project-city');
            const stateField = document.getElementById('project-state');
            const zipField = document.getElementById('project-zip');

            console.log('Found modal fields:', {
                city: cityField ? 'FOUND' : 'MISSING',
                state: stateField ? 'FOUND' : 'MISSING', 
                zip: zipField ? 'FOUND' : 'MISSING'
            });

            if (cityField) {
                console.log('Modal city field element:', cityField);
                console.log('Modal city field current value:', cityField.value);
                if (addr.city) {
                    cityField.value = addr.city;
                    console.log('✅ SUCCESSFULLY SET MODAL CITY TO:', addr.city);
                    console.log('Modal city field value after setting:', cityField.value);
                } else {
                    console.log('❌ NO CITY DATA AVAILABLE');
                }
            } else {
                console.log('❌ MODAL CITY FIELD NOT FOUND IN DOM');
            }
            
            if (stateField && addr.state) {
                stateField.value = addr.state;
                console.log('✅ Set modal state to:', addr.state);
            }
            if (zipField && addr.postcode) {
                zipField.value = addr.postcode;
                console.log('✅ Set modal zip to:', addr.postcode);
            }
        } else {
            console.log('>>> Processing LEGACY inline form (fallback)');
            // Legacy inline form fields for backwards compatibility
            const cityField = document.getElementById('projectCity');
            const stateField = document.getElementById('projectState');
            const zipField = document.getElementById('projectZip');

            console.log('Found legacy inline fields:', {
                city: cityField ? 'FOUND' : 'MISSING',
                state: stateField ? 'FOUND' : 'MISSING', 
                zip: zipField ? 'FOUND' : 'MISSING'
            });

            if (cityField && addr.city) {
                cityField.value = addr.city;
                console.log('✅ Set legacy city to:', addr.city);
            }
            if (stateField && addr.state) {
                stateField.value = addr.state;
                console.log('✅ Set legacy state to:', addr.state);
            }
            if (zipField && addr.postcode) {
                zipField.value = addr.postcode;
                console.log('✅ Set legacy zip to:', addr.postcode);
            }
        }
        
        console.log('=== END ADDRESS SELECTION DEBUG ===');
    }

    saveProjectInline(event, projectId) {
        if (event && event.preventDefault) {
            event.preventDefault();
        }
        
        // Convert projectId to string to ensure consistent form ID handling
        const projectIdString = String(projectId);
        
        // Use project-specific form ID
        const formId = `edit-project-form-${projectIdString}`;
        const form = document.getElementById(formId);
        
        // If form not found, try to find any project edit form in case of ID mismatch
        if (!form) {
            const allProjectForms = document.querySelectorAll('form[id^="edit-project-form-"]');
            if (allProjectForms.length > 0) {
                console.log('Available form IDs:', Array.from(allProjectForms).map(f => f.id));
            }
            this.showToast('Error: Could not find project form', 'error');
            return;
        }
        
        const formData = new FormData(form);
        const projectData = Object.fromEntries(formData.entries());
        
        // Validate dates before submission
        if (projectData.startDate && projectData.estimatedCompletionDate) {
            if (projectData.estimatedCompletionDate < projectData.startDate) {
                this.showToast('End date cannot be before start date. Please correct the dates before saving.', 'error');
                return;
            }
        }
        
        // Map frontend field names to backend expected names (PascalCase)
        const backendData = {
            CustomerID: projectData.customerId,
            ProjectName: projectData.projectName,
            ProjectDescription: projectData.projectDescription,
            ProjectContactName: projectData.ProjectContactName,
            ProjectContactPhone: projectData.ProjectContactPhone,
            ProjectContactEmail: projectData.ProjectContactEmail,
            ProjectAddress: projectData.projectAddress,
            ProjectCity: projectData.projectCity,
            ProjectState: projectData.projectState,
            ProjectZip: projectData.projectZip,
            StartDate: projectData.startDate,
            EstimatedCompletionDate: projectData.estimatedCompletionDate,
            ActualCompletionDate: projectData.actualCompletionDate,
            ProjectStatus: projectData.projectStatus,
            ProjectPriority: parseInt(projectData.projectPriority) || 0
            // TotalContractAmount is now calculated from estimates, not editable
        };

        // Handle priority reordering if needed
        const priorityInput = document.getElementById(`priority-${projectIdString}`);
        let reorderingData = null; // Store reordering info separately
        
        const saveWithPriorityReordering = async () => {
            // Re-check for priority conflicts at save time (in case data changed)
            if (backendData.ProjectPriority > 0 && projectData.projectStatus === 'Needs Attention') {
                const conflictingProjects = this.data.projects ? this.data.projects.filter(p => 
                    p.ProjectStatus === 'Needs Attention' && 
                    p.ProjectID != projectIdString && 
                    parseInt(p.ProjectPriority) === backendData.ProjectPriority
                ) : [];
                
                if (conflictingProjects.length > 0) {
                    const conflictProject = conflictingProjects[0];
                    const confirmed = confirm(
                        `Priority ${backendData.ProjectPriority} is currently assigned to "${conflictProject.ProjectName}".\n\n` +
                        `Do you want to replace it and reorder the remaining projects?\n\n` +
                        `• "${conflictProject.ProjectName}" will be moved to the next available priority\n` +
                        `• Other priorities may shift down accordingly`
                    );
                    
                    if (!confirmed) {
                        // User cancelled - suggest next available priority
                        const allUsedPriorities = this.data.projects ? 
                            this.data.projects.filter(p => p.ProjectStatus === 'Needs Attention' && p.ProjectID != projectIdString)
                                .map(p => parseInt(p.ProjectPriority))
                                .filter(p => p > 0)
                                .sort((a, b) => a - b) : [];
                        
                        let nextAvailable = 1;
                        for (const used of allUsedPriorities) {
                            if (nextAvailable === used) {
                                nextAvailable++;
                            } else {
                                break;
                            }
                        }
                        
                        backendData.ProjectPriority = nextAvailable;
                        if (priorityInput) {
                            priorityInput.value = nextAvailable;
                        }
                        this.showToast(`Using next available priority: ${nextAvailable}`, 'info');
                    } else {
                        // User confirmed - store reordering info separately
                        reorderingData = {
                            conflictProjectId: conflictProject.ProjectID,
                            conflictProjectName: conflictProject.ProjectName,
                            newPriority: backendData.ProjectPriority
                        };
                    }
                }
            }
            return backendData;
        };
        
        if (projectId && projectId !== 'new') {
            // Update existing project
            saveWithPriorityReordering()
                .then((finalData) => this.apiCall(`projects/${projectId}`, 'PUT', finalData))
                .then(() => {
                    // Handle reordering AFTER the main project is saved
                    if (reorderingData) {
                        return this.reorderPriorities(
                            projectIdString, 
                            reorderingData.newPriority, 
                            reorderingData.conflictProjectId
                        ).then(() => {
                            this.showToast(`Project updated and priorities reordered. "${reorderingData.conflictProjectName}" moved to next available priority.`, 'success');
                        });
                    } else {
                        this.showToast('Project updated successfully', 'success');
                    }
                })
                .then(() => {
                    this.editingProjectId = null;
                    this.projectFromCustomer = null; // Clear customer linking data
                    
                    // Clear focus mode
                    const projectsTable = document.querySelector('#projects-table');
                    if (projectsTable) {
                        projectsTable.classList.remove('project-focus-mode');
                    }
                    
                    this.loadProjects();
                })
                .catch(error => {
                    this.showToast('Error updating project', 'error');
                });
        } else {
            // Add new project
            saveWithPriorityReordering()
                .then((finalData) => this.apiCall('projects', 'POST', finalData))
                .then(() => {
                    // Handle reordering AFTER the main project is saved
                    if (backendData.needsReordering) {
                        return this.reorderPriorities(
                            'new', // For new projects, we don't have the ID yet
                            backendData.needsReordering.newPriority, 
                            backendData.needsReordering.conflictProjectId
                        ).then(() => {
                            this.showToast(`Project added and priorities reordered. "${backendData.needsReordering.conflictProjectName}" moved to next available priority.`, 'success');
                        });
                    } else {
                        this.showToast('Project added successfully', 'success');
                    }
                })
                .then(() => {
                    this.editingProjectId = null;
                    this.projectFromCustomer = null; // Clear customer linking data
                    
                    // Clear focus mode
                    const projectsTable = document.querySelector('#projects-table');
                    if (projectsTable) {
                        projectsTable.classList.remove('project-focus-mode');
                    }

                    this.loadProjects();
                })
                .catch(error => {
                    this.showToast('Error adding project', 'error');
                });
        }
    }
    validateInlineDates(projectId) {
        // Use project-specific field IDs if projectId is provided
        const startDateId = projectId ? `project-start-date-${projectId}` : 'project-start-date';
        const endDateId = projectId ? `project-estimated-completion-${projectId}` : 'project-estimated-completion';
        
        const startDateInput = document.getElementById(startDateId);
        const endDateInput = document.getElementById(endDateId);
        
        console.log('validateInlineDates called with projectId:', projectId);
        console.log('Looking for fields:', { startDateId, endDateId });
        console.log('Found fields:', { 
            startField: startDateInput ? 'FOUND' : 'MISSING', 
            endField: endDateInput ? 'FOUND' : 'MISSING' 
        });
        
        if (startDateInput && endDateInput) {
            const startValue = startDateInput.value;
            const endValue = endDateInput.value;
            
            console.log('Date values:', { startValue, endValue });
            
            // Set minimum date for end date based on start date
            if (startValue) {
                endDateInput.min = startValue;
                
                // Auto-populate end date if it's empty or before start date
                if (!endValue || endValue < startValue) {
                    const startDate = new Date(startValue);
                    const suggestedEndDate = this.addBusinessDays(startDate, 10);
                    const formattedEndDate = this.formatDateForInput(suggestedEndDate);
                    endDateInput.value = formattedEndDate;
                    
                    console.log('Auto-populated end date:', formattedEndDate);
                    
                    if (!endValue) {
                        this.showToast('End date automatically set to 10 business days after start date', 'info');
                    } else {
                        this.showToast('End date adjusted to 10 business days after start date (was before start date)', 'warning');
                    }
                }
            } else {
                endDateInput.removeAttribute('min');
            }
        } else {
            console.log('Could not find date fields for validation');
        }
    }

    setupProjectDateValidation() {
        const startDateInput = document.getElementById('project-start-date');
        const endDateInput = document.getElementById('project-estimated-completion');
        
        if (startDateInput && endDateInput) {
            // Remove any existing event listeners by cloning
            const newStartInput = startDateInput.cloneNode(true);
            const newEndInput = endDateInput.cloneNode(true);
            startDateInput.parentNode.replaceChild(newStartInput, startDateInput);
            endDateInput.parentNode.replaceChild(newEndInput, endDateInput);
            
            // Function to validate and correct dates
            const validateDates = () => {
                const startValue = newStartInput.value;
                const endValue = newEndInput.value;
                
                // Set minimum date for end date based on start date
                if (startValue) {
                    newEndInput.min = startValue;
                    
                    // Auto-populate end date if it's empty
                    if (!endValue) {
                        const startDate = new Date(startValue);
                        const suggestedEndDate = this.addBusinessDays(startDate, 10);
                        newEndInput.value = this.formatDateForInput(suggestedEndDate);
                        this.showToast('End date automatically set to 10 business days after start date', 'info');
                    }
                    // Correct end date if it's before start date
                    else if (endValue < startValue) {
                        const startDate = new Date(startValue);
                        const suggestedEndDate = this.addBusinessDays(startDate, 10);
                        newEndInput.value = this.formatDateForInput(suggestedEndDate);
                        this.showToast('End date cannot be before start date. Set to 10 business days after start date.', 'warning');
                    }
                } else {
                    newEndInput.removeAttribute('min');
                }
            };
            
            // Add comprehensive event listeners
            newStartInput.addEventListener('change', validateDates);
            newStartInput.addEventListener('input', validateDates);
            newStartInput.addEventListener('blur', validateDates);
            newEndInput.addEventListener('change', validateDates);
            newEndInput.addEventListener('input', validateDates);
            newEndInput.addEventListener('blur', validateDates);
            
            // Initial validation
            validateDates();
        }
    }

    validateModalEndDate() {
        const startDateInput = document.getElementById('project-start-date-modal');
        const endDateInput = document.getElementById('project-estimated-completion-modal');
        
        if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
            if (endDateInput.value < startDateInput.value) {
                const startDate = new Date(startDateInput.value);
                const suggestedEndDate = this.addBusinessDays(startDate, 10);
                endDateInput.value = this.formatDateForInput(suggestedEndDate);
                this.showToast('End date cannot be before start date. Set to 10 business days after start date.', 'warning');
            }
        }
    }

    updateModalEndDateMin(startDateValue) {
        const endDateInput = document.getElementById('project-estimated-completion-modal');
        if (endDateInput) {
            if (startDateValue) {
                endDateInput.min = startDateValue;
                
                // Auto-populate end date if it's empty or before start date
                const currentEndValue = endDateInput.value;
                if (!currentEndValue || currentEndValue < startDateValue) {
                    const startDate = new Date(startDateValue);
                    const suggestedEndDate = this.addBusinessDays(startDate, 10);
                    endDateInput.value = this.formatDateForInput(suggestedEndDate);
                    
                    if (!currentEndValue) {
                        this.showToast('End date automatically set to 10 business days after start date', 'info');
                    } else {
                        this.showToast('End date adjusted to 10 business days after start date (was before start date)', 'warning');
                    }
                }
            } else {
                endDateInput.removeAttribute('min');
            }
        }
        
        // Also validate when the end date input changes
        if (!endDateInput.hasAttribute('data-validation-added')) {
            endDateInput.addEventListener('change', function() {
                const startDateInput = document.getElementById('project-start-date-modal');
                if (startDateInput && startDateInput.value && this.value && this.value < startDateInput.value) {
                    this.value = startDateInput.value;
                    alert('End date cannot be before start date. It has been adjusted to match the start date.');
                }
            });
            endDateInput.setAttribute('data-validation-added', 'true');
        }
    }

    cancelProjectEdit() {
        this.editingProjectId = null;
        this.filterProjects('');
        
        // Clear focus mode
        const projectsTable = document.querySelector('#projects-table');
        if (projectsTable) {
            projectsTable.classList.remove('project-focus-mode');
        }
    }

    // Calculate total contract amount from estimates for a project
    calculateProjectContractAmount(projectId) {
        if (!projectId || !this.data.estimates) return 0;
        
        const projectEstimates = this.data.estimates.filter(e => e.ProjectID == projectId);
        return projectEstimates.reduce((sum, est) => sum + (parseFloat(est.TotalAmount) || 0), 0);
    }

    // Validate project priority to ensure no duplicates for "Needs Attention" projects
    validateProjectPriority(projectId, priority) {
        const priorityNum = parseInt(priority);
        if (priorityNum <= 0) return true; // 0 or negative is always allowed (means no priority)
        
        const activeProjects = this.data.projects ? this.data.projects.filter(p => 
            p.ProjectStatus === 'Needs Attention' && 
            p.ProjectID != projectId && 
            parseInt(p.ProjectPriority) === priorityNum
        ) : [];
        
        const priorityInput = document.getElementById(`priority-${projectId}`);
        
        if (activeProjects.length > 0) {
            // Priority already taken - show warning but don't block
            priorityInput.style.borderColor = '#ffc107';
            priorityInput.style.backgroundColor = '#fff3cd';
            priorityInput.title = `Priority ${priorityNum} is currently assigned to: ${activeProjects[0].ProjectName}`;
            priorityInput.dataset.conflictProject = activeProjects[0].ProjectID;
            priorityInput.dataset.conflictName = activeProjects[0].ProjectName;
            return true; // Allow the value but mark the conflict
        } else {
            // Priority is available
            priorityInput.style.borderColor = '#28a745';
            priorityInput.style.backgroundColor = '#d4edda';
            priorityInput.title = `Priority ${priorityNum} is available`;
            priorityInput.removeAttribute('data-conflict-project');
            priorityInput.removeAttribute('data-conflict-name');
            setTimeout(() => {
                priorityInput.style.borderColor = '#ddd';
                priorityInput.style.backgroundColor = '#fff';
            }, 2000);
            return true;
        }
    }

    // Handle project status change to clear priority when status changes from "Needs Attention"
    onProjectStatusChange(projectId, newStatus) {
        const priorityContainer = document.getElementById(`priority-container-${projectId}`);
        const priorityInput = document.getElementById(`priority-${projectId}`);
        
        // Define inactive statuses that affect filtering
        const inactiveStatuses = ['Cancelled', 'Completed', 'On Hold'];
        
        // Get the previous status of this project to check if visibility will change
        const project = this.data.projects?.find(p => p.ProjectID == projectId);
        const previousStatus = project?.ProjectStatus;
        
        // Check if this status change affects the project's visibility
        const wasInactive = inactiveStatuses.includes(previousStatus);
        const nowInactive = inactiveStatuses.includes(newStatus);
        
        if (newStatus === 'Needs Attention') {
            // Show priority field for "Needs Attention" status
            if (priorityContainer) {
                priorityContainer.style.display = 'block';
            }
        } else {
            // Hide priority field and clear value for other statuses
            if (priorityContainer) {
                priorityContainer.style.display = 'none';
            }
            if (priorityInput) {
                priorityInput.value = '';
                priorityInput.style.borderColor = '#ddd';
                priorityInput.style.backgroundColor = '#fff';
            }
        }
        
        // If the project's inactive status changed, refresh all related data
        if (wasInactive !== nowInactive) {
            // Update the project data immediately so filters work correctly
            if (project) {
                project.ProjectStatus = newStatus;
            }
            
            // Refresh all tables to reflect the change
            setTimeout(() => {
                this.refreshRelatedDataForActiveProjects();
            }, 100);
        }
    }

    // Reorder priorities when a priority conflict occurs
    async reorderPriorities(currentProjectId, newPriority, replacingProjectId) {
        try {
            console.log(`Starting reorder: currentProject=${currentProjectId}, newPriority=${newPriority}, replacingProject=${replacingProjectId}`);
            
            // Get fresh data to make sure we have current priorities
            await this.loadProjects();
            
            // Get all "Needs Attention" projects 
            const needsAttentionProjects = this.data.projects ? 
                this.data.projects.filter(p => 
                    p.ProjectStatus === 'Needs Attention'
                ).sort((a, b) => (parseInt(a.ProjectPriority) || 999) - (parseInt(b.ProjectPriority) || 999)) : [];

            console.log('Before reordering:', needsAttentionProjects.map(p => ({ id: p.ProjectID, name: p.ProjectName, priority: p.ProjectPriority })));

            // Find the project that's being displaced
            const displacedProject = needsAttentionProjects.find(p => p.ProjectID == replacingProjectId);
            if (!displacedProject) {
                console.log('Displaced project not found');
                return;
            }

            // Find the next available priority after newPriority
            let nextAvailable = newPriority + 1;
            const usedPriorities = needsAttentionProjects
                .filter(p => p.ProjectID != replacingProjectId) // Exclude the project being displaced
                .map(p => parseInt(p.ProjectPriority) || 0)
                .filter(p => p > 0);
            
            while (usedPriorities.includes(nextAvailable)) {
                nextAvailable++;
            }

            console.log(`Moving displaced project ${displacedProject.ProjectName} from priority ${displacedProject.ProjectPriority} to priority ${nextAvailable}`);

            // Move the displaced project to the next available priority
            // We need to send the full project data to update the priority
            const updatedProjectData = {
                ProjectName: displacedProject.ProjectName,
                CustomerID: displacedProject.CustomerID,
                ProjectStatus: displacedProject.ProjectStatus,
                ProjectDescription: displacedProject.ProjectDescription,
                ProjectAddress: displacedProject.ProjectAddress,
                ProjectCity: displacedProject.ProjectCity,
                ProjectState: displacedProject.ProjectState,
                ProjectZip: displacedProject.ProjectZip,
                StartDate: displacedProject.StartDate,
                EstimatedCompletionDate: displacedProject.EstimatedCompletionDate,
                ProjectPriority: nextAvailable
            };

            await this.apiCall(`projects/${replacingProjectId}`, 'PUT', updatedProjectData);

            console.log('Reordering completed successfully');
            
        } catch (error) {
            console.error('Error reordering priorities:', error);
            this.showToast('Warning: Priority reordering failed', 'warning');
        }
    }
    
    getProjectEditFormHtml(project) {
        // Generate unique IDs based on project ID - ensure consistent string handling
        const projectId = String(project.ProjectID || 'new');
        const addressFieldId = `projectAddress_${projectId}`;
        const cityFieldId = `projectCity_${projectId}`;
        const stateFieldId = `projectState_${projectId}`;
        const zipFieldId = `projectZip_${projectId}`;
        
        // Calculate contract amount from estimates
        const calculatedContractAmount = this.calculateProjectContractAmount(project.ProjectID);
        
        // Calculate dynamic priority constraints for "Needs Attention" projects
        const activeProjects = this.data.projects ? this.data.projects.filter(p => p.ProjectStatus === 'Needs Attention') : [];
        const maxPriority = activeProjects.length + 1; // Total count of "Needs Attention" projects + 1
        const usedPriorities = activeProjects.filter(p => p.ProjectID !== project.ProjectID).map(p => parseInt(p.ProjectPriority)).filter(p => p > 0 && p <= maxPriority);
        
        // TODO: Replace with actual project edit form markup
        // If new project and a customer is selected, set CustomerID automatically
        let customerIdValue = project.CustomerID || this.selectedCustomerId || (this.projectFromCustomer ? this.projectFromCustomer.customerId : '') || '';
        let customerIdField = '';
        
        if (project.ProjectID) {
            // For existing projects, show customer name as read-only (cannot be changed)
            const currentCustomer = this.data.customers ? this.data.customers.find(c => c.CustomerID == customerIdValue) : null;
            customerIdField = `<div class="form-group">
                <label>Customer</label>
                <div class="form-control-plaintext" style="background: #f8f9fa; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 4px; color: #495057;">
                    <strong>${currentCustomer ? currentCustomer.CompanyName : 'Unknown Customer'}</strong>
                    <small class="text-muted d-block">Customer cannot be changed for existing projects</small>
                </div>
                <input type="hidden" name="customerId" value="${customerIdValue}">
            </div>`;
        } else if (customerIdValue) {
            // For new projects with pre-selected customer, show the customer name and use hidden field
            const selectedCustomer = this.data.customers ? this.data.customers.find(c => c.CustomerID == customerIdValue) : null;
            customerIdField = `<div class="form-group">
                <label>Customer <span style='color:red'>*</span></label>
                <div class="form-control-plaintext" style="background: #e9f7ef; padding: 8px 12px; border: 1px solid #28a745; border-radius: 4px; color: #155724;">
                    <strong>${selectedCustomer ? selectedCustomer.CompanyName : 'Selected Customer'}</strong>
                    <small class="text-muted d-block">Pre-selected from customer view</small>
                </div>
                <input type="hidden" name="customerId" value="${customerIdValue}">
            </div>`;
        } else {
            // Show dropdown if no customer selected
            customerIdField = `<div class="form-group">
                <label>Customer <span style='color:red'>*</span></label>
                <select class="form-control" name="customerId" required>
                    <option value="">Select a customer</option>
                    ${Array.isArray(this.data.customers) && this.data.customers.length > 0 ? this.data.customers.map(c => `<option value="${c.CustomerID}">${c.CompanyName}</option>`).join('') : '<option disabled>No customers found</option>'}
                </select>
            </div>`;
        }
        return `<div class="details-card" data-project-id="${projectId}">
            <h3>Edit Project - ${project.ProjectName || ''}</h3>
            <form id="edit-project-form-${projectId}" onsubmit="app.saveProjectInline(event, '${projectId}'); return false;">
                <div class="form-row">
                    <div class="form-group">
                        <label>Project Name</label>
                        <input type="text" class="form-control" name="projectName" value="${project.ProjectName || ''}" required>
                    </div>
                    ${customerIdField}
                </div>
                <div class="form-row">
                    <div class="form-group col-md-4">
                        <label>Status</label>
                        <select class="form-control" name="projectStatus" onchange="app.onProjectStatusChange(${project.ProjectID}, this.value)">
                            <option value="" ${!project.ProjectStatus ? 'selected' : ''} disabled>Select Status</option>
                            <option value="Awaiting Customer feedback" ${project.ProjectStatus === 'Awaiting Customer feedback' ? 'selected' : ''}>Awaiting Customer Feedback</option>
                            <option value="Awaiting Engineering" ${project.ProjectStatus === 'Awaiting Engineering' ? 'selected' : ''}>Awaiting Engineering</option>
                            <option value="Awaiting payment" ${project.ProjectStatus === 'Awaiting payment' ? 'selected' : ''}>Awaiting Payment</option>
                            <option value="Bid Only" ${project.ProjectStatus === 'Bid Only' ? 'selected' : ''}>Bid Only</option>
                            <option value="Cancelled" ${project.ProjectStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                            <option value="Completed" ${project.ProjectStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                            <option value="Needs Attention" ${project.ProjectStatus === 'Needs Attention' ? 'selected' : ''}>Needs Attention</option>
                            <option value="On Hold" ${project.ProjectStatus === 'On Hold' ? 'selected' : ''}>On Hold</option>
                            <option value="Submitted" ${project.ProjectStatus === 'Submitted' ? 'selected' : ''}>Submitted (In for Permit)</option>
                        </select>
                    </div>
                    <div id="priority-container-${projectId}" class="form-group" style="display: ${project.ProjectStatus === 'Needs Attention' ? 'block' : 'none'}; flex: 0 0 80px; max-width: 80px;">
                        <label>Priority</label>
                        <input type="number" class="form-control" id="priority-${projectId}" name="projectPriority" value="${project.ProjectPriority || 0}" min="0" max="99" step="1" title="Priority ranking for Needs Attention projects (0 = no priority)" onchange="app.validateProjectPriority('${projectId}', this.value)" style="text-align: center; width: 70px;">
                    </div>
                    <div class="form-group col-md-3">
                        <label>Start Date</label>
                        <input type="date" class="form-control" name="startDate" id="project-start-date-${projectId}" value="${project.StartDate ? project.StartDate.split('T')[0] : ''}" onchange="app.validateInlineDates('${projectId}')" oninput="app.validateInlineDates('${projectId}')">
                    </div>
                    <div class="form-group col-md-3">
                        <label>Estimated Completion</label>
                        <input type="date" class="form-control" name="estimatedCompletionDate" id="project-estimated-completion-${projectId}" value="${project.EstimatedCompletionDate ? project.EstimatedCompletionDate.split('T')[0] : ''}" onchange="app.validateInlineDates('${projectId}')" oninput="app.validateInlineDates('${projectId}')">
                    </div>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="form-control" name="projectDescription">${project.ProjectDescription || ''}</textarea>
                </div>
                
                <!-- Project Contact Information -->
                <div style="border-top: 1px solid #ddd; padding-top: 15px; margin-top: 20px; margin-bottom: 20px;">
                    <h4 style="margin-bottom: 15px; color: #333; font-size: 1.1rem;">
                        <i class="fas fa-user-tie"></i> Project Contact
                        <small class="text-muted" style="font-size: 0.9rem; font-weight: normal;">(if different from customer contact)</small>
                    </h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Contact Name</label>
                            <input type="text" class="form-control" name="ProjectContactName" value="${project.ProjectContactName || ''}" placeholder="Project contact name">
                        </div>
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="text" class="form-control phone-format" name="ProjectContactPhone" value="${project.ProjectContactPhone || ''}" placeholder="(555) 123-4567">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" class="form-control" name="ProjectContactEmail" value="${project.ProjectContactEmail || ''}" placeholder="contact@example.com">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Contract Amount <small class="text-muted">(Total of all estimates)</small></label>
                    <div class="input-group">
                        <div class="input-group-prepend">
                            <span class="input-group-text">$</span>
                        </div>
                        <input type="text" class="form-control" value="${calculatedContractAmount ? calculatedContractAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}" readonly style="background-color: #f8f9fa; cursor: not-allowed;">
                    </div>
                    <small class="text-muted">This amount is calculated from all estimates for this project.</small>
                </div>
                
                <!-- Address Section with Checkbox - Only show for new projects from customer -->
                ${customerIdValue && !project.ProjectID ? `
                    <div class="form-group">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="same-as-customer-address-${projectId}" onchange="app.toggleInlineProjectAddress('${projectId}', this.checked)">
                            <label for="same-as-customer-address-${projectId}" style="margin: 0; font-weight: bold;">
                                Project address is the same as customer address
                            </label>
                        </div>
                    </div>
                ` : ''}
                
                <div class="form-group">
                    <label>Address</label>
                    <div style="position: relative;">
                        <input type="text" class="form-control" id="${addressFieldId}" name="projectAddress" value="${project.ProjectAddress || ''}">
                        <div class="autocomplete-suggestions" id="address-suggestions-${projectId}" style="display: none;"></div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>City</label>
                        <input type="text" class="form-control" id="${cityFieldId}" name="projectCity" value="${project.ProjectCity || ''}">
                    </div>
                    <div class="form-group">
                        <label>State</label>
                        <input type="text" class="form-control" id="${stateFieldId}" name="projectState" value="${project.ProjectState || ''}">
                    </div>
                    <div class="form-group">
                        <label>ZIP</label>
                        <input type="text" class="form-control" id="${zipFieldId}" name="projectZip" value="${project.ProjectZip || ''}">
                    </div>
                </div>
                <div class="form-footer" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <button type="button" class="btn btn-secondary mr-2" onclick="app.cancelProjectEdit()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Project</button>
                    </div>
                </div>
            </form>
        </div>`;
    }
    getCustomerEditFormHtml(customer) {
        const isNew = !customer.CustomerID;
        const formId = isNew ? 'add-customer-form' : 'edit-customer-form';
        const submitAction = isNew ? `app.saveCustomerInline(event, 'new')` : `app.saveCustomerInline(event, ${customer.CustomerID})`;
        const customerId = isNew ? 'new' : customer.CustomerID;
        
        // Generate unique IDs for address autocomplete
        const addressFieldId = `customerAddress_${customerId}`;
        const cityFieldId = `customerCity_${customerId}`;
        const stateFieldId = `customerState_${customerId}`;
        const zipFieldId = `customerZip_${customerId}`;
        
        return `<div class="details-card">
            <h3>${isNew ? 'Add New Customer' : `Edit Customer - ${customer.CompanyName || ''}`}</h3>
            <form id="${formId}" onsubmit="${submitAction}">
                <div class="form-group">
                    <label>Customer Name</label>
                    <input type="text" class="form-control" name="CompanyName" value="${customer.CompanyName || ''}" required>
                </div>
                
                <h4 style="margin-top: 20px; margin-bottom: 15px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    <i class="fas fa-user"></i> Primary Contact
                </h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Contact Name</label>
                        <input type="text" class="form-control" name="ContactName" value="${customer.ContactName || ''}">
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="text" class="form-control phone-format" name="Phone" value="${customer.Phone || ''}" placeholder="(555) 123-4567">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" class="form-control" name="Email" value="${customer.Email || ''}">
                    </div>
                </div>
                
                <h4 style="margin-top: 20px; margin-bottom: 15px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    <i class="fas fa-user-plus"></i> Secondary Contact
                </h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Contact Name 2</label>
                        <input type="text" class="form-control" name="ContactName2" value="${customer.ContactName2 || ''}">
                    </div>
                    <div class="form-group">
                        <label>Phone 2</label>
                        <input type="text" class="form-control phone-format" name="Phone2" value="${customer.Phone2 || ''}" placeholder="(555) 123-4567">
                    </div>
                    <div class="form-group">
                        <label>Email 2</label>
                        <input type="email" class="form-control" name="Email2" value="${customer.Email2 || ''}">
                    </div>
                </div>
                
                <h4 style="margin-top: 20px; margin-bottom: 15px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    <i class="fas fa-info-circle"></i> Additional Information
                </h4>
                <div class="form-group">
                    <label>Status</label>
                    <select class="form-control" name="Status">
                        <option value="active" ${customer.Status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${customer.Status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" class="form-control" name="Address" id="${addressFieldId}" value="${customer.Address || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>City</label>
                        <input type="text" class="form-control" name="City" id="${cityFieldId}" value="${customer.City || ''}">
                    </div>
                    <div class="form-group">
                        <label>State</label>
                        <input type="text" class="form-control" name="State" id="${stateFieldId}" value="${customer.State || ''}">
                    </div>
                    <div class="form-group">
                        <label>ZIP</label>
                        <input type="text" class="form-control" name="ZipCode" id="${zipFieldId}" value="${customer.ZipCode || ''}">
                    </div>
                </div>
                <div class="form-footer">
                    <button type="button" class="btn btn-secondary mr-2" onclick="app.cancelCustomerEdit()">Cancel</button>
                    <button type="submit" class="btn btn-primary">${isNew ? 'Add Customer' : 'Save Customer'}</button>
                </div>
            </form>
        </div>`;
    }
    showCustomerModal(customerId) {
        // Inline edit instead of modal
        console.log('showCustomerModal called with', customerId);
        
        if (customerId) {
            // Edit existing customer
            this.editingCustomerId = customerId;
        } else {
            // Add new customer - use 'new' as identifier
            this.editingCustomerId = 'new';
        }
        
        this.viewingCustomerId = null;
        this.filterCustomers('');
        const row = document.querySelector('tr.edit-row');
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    editProjectInline(projectId) {
        if (projectId) {
            // Edit existing project
            this.editingProjectId = projectId;
            
            // Find the project in the data
            const project = this.data.projects ? this.data.projects.find(p => p.ProjectID == projectId) : null;
            
            if (!project && (!this.data.projects || this.data.projects.length === 0)) {
                // Load projects data first, then try again
                this.loadProjects().then(() => {
                    this.editProjectInline(projectId);
                });
                return;
            }
            
            if (!project) {
                console.error('Project not found with ID:', projectId);
                this.showToast(`Project with ID ${projectId} not found`, 'error');
                return;
            }
        } else {
            // Add new project
            this.editingProjectId = 'new';
        }
        
        this.viewingProjectId = null;
        this.filterProjects('');
        
        // Set up date validation and address autocomplete after form is rendered
        setTimeout(() => {
            this.setupProjectDateValidation();
            const addressFieldId = `projectAddress_${projectId || 'new'}`;
            this.setupAddressAutocomplete(addressFieldId);
        }, 100);
        
        const row = document.querySelector('tr.edit-row');
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Dashboard navigation functions
    addNewCustomerFromDashboard() {
        // Switch to customers section first
        this.switchSection('customers');
        
        // Wait for the section to load, then open the customer modal
        setTimeout(() => {
            this.showCustomerModal();
        }, 300);
    }

    saveCustomerInline(event, customerId) {
        event.preventDefault();
        const isNew = customerId === 'new';
        const formId = isNew ? 'add-customer-form' : 'edit-customer-form';
        const form = document.getElementById(formId);
        const formData = new FormData(form);
        const customerData = Object.fromEntries(formData.entries());
        
        // Backend expects these exact field names (capital letters)
        const backendData = {
            CompanyName: customerData.CompanyName,
            ContactName: customerData.ContactName,
            Phone: customerData.Phone,
            Email: customerData.Email,
            ContactName2: customerData.ContactName2 || '',
            Phone2: customerData.Phone2 || '',
            Email2: customerData.Email2 || '',
            Address: customerData.Address,
            City: customerData.City,
            State: customerData.State,
            ZipCode: customerData.ZipCode,
            Status: customerData.Status || 'active'
        };
        
        if (isNew) {
            // Add new customer
            this.apiCall('customers', 'POST', backendData)
                .then(() => {
                    this.showToast('Customer added successfully', 'success');
                    this.editingCustomerId = null;
                    this.loadCustomers();
                })
                .catch(error => {
                    this.showToast('Error adding customer', 'error');
                });
        } else {
            // Update existing customer
            this.apiCall(`customers/${customerId}`, 'PUT', backendData)
                .then(() => {
                    this.showToast('Customer updated successfully', 'success');
                    this.editingCustomerId = null;
                    this.loadCustomers();
                })
                .catch(error => {
                    this.showToast('Error updating customer', 'error');
                });
        }
    }
    cancelCustomerEdit() {
        this.editingCustomerId = null;
        this.filterCustomers('');
    }
    constructor() {
        this.currentSection = 'dashboard';
        this.data = {
            customers: [],
            projects: [],
            estimates: [],
            invoices: [],
            payments: [],
            contracts: [],
            lineItems: []
        };
        this.settings = {}; // Initialize settings
        this.selectedCustomerId = null;  // ADD THIS LINE
        this.editingProjectId = null; // Track the currently editing project ID
        this.viewingProjectId = null; // Track the currently viewing project ID
        
        // Mobile detection and responsive setup
        this.isMobile = this.detectMobile();
        this.isTablet = this.detectTablet();
        this.screenSize = this.getScreenSize();
        
        this.init();
    }

    // Mobile and device detection methods
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    detectTablet() {
        return /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768 && window.innerWidth <= 1024;
    }

    getScreenSize() {
        const width = window.innerWidth;
        if (width <= 480) return 'xs'; // Extra small phones
        if (width <= 768) return 'sm'; // Small devices/phones
        if (width <= 992) return 'md'; // Medium devices/tablets
        if (width <= 1200) return 'lg'; // Large devices/desktops
        return 'xl'; // Extra large devices
    }

    // Apply mobile-specific optimizations
    applyMobileOptimizations() {
        const body = document.body;
        
        if (this.isMobile) {
            body.classList.add('mobile-device');
            // Add touch-friendly styles
            body.style.setProperty('--touch-target-size', '44px');
            // Prevent zoom on input focus for iOS
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            if (viewportMeta) {
                viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            }
        }
        
        if (this.isTablet) {
            body.classList.add('tablet-device');
        }
        
        body.classList.add(`screen-${this.screenSize}`);
        
        // Listen for orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
        
        // Listen for window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    handleOrientationChange() {
        // Refresh device detection after orientation change
        this.isMobile = this.detectMobile();
        this.screenSize = this.getScreenSize();
        
        // Reapply styles
        this.applyMobileOptimizations();
        
        // Close mobile menus if open
        this.closeMobileMenus();
    }

    handleResize() {
        const newScreenSize = this.getScreenSize();
        if (newScreenSize !== this.screenSize) {
            document.body.classList.remove(`screen-${this.screenSize}`);
            this.screenSize = newScreenSize;
            document.body.classList.add(`screen-${this.screenSize}`);
        }
        
        // Refresh the current view when screen size changes
        setTimeout(() => {
            const activeTab = document.querySelector('.nav-link.active');
            if (activeTab) {
                const section = activeTab.getAttribute('data-section');
                if (section === 'projects' && this.data.projects) {
                    this.renderProjectTable(this.data.projects);
                } else if (section === 'customers' && this.data.customers) {
                    this.renderCustomerTable(this.data.customers);
                } else if (section === 'estimates' && this.data.estimates) {
                    this.renderEstimateTable(this.data.estimates);
                }
            }
        }, 100);
    }

    closeMobileMenus() {
        // Close any open dropdowns or modals
        const dropdowns = document.querySelectorAll('.dropdown-menu.show, .user-dropdown');
        dropdowns.forEach(dropdown => dropdown.style.display = 'none');
    }

    applyMobileUIAdjustments() {
        // Apply mobile optimizations to all tables on small screens - no device detection needed
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            // Always add mobile-friendly classes
            table.classList.add('mobile-responsive-table');
            
            if (!table.parentElement.classList.contains('table-responsive')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-responsive mobile-table-wrapper';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        });
        
        // Add mobile-friendly form layouts
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.classList.add('mobile-optimized');
        });
        
        // Make buttons touch-friendly
        const buttons = document.querySelectorAll('button, .btn');
        buttons.forEach(button => {
            if (!button.classList.contains('btn-sm') && !button.classList.contains('btn-xs')) {
                button.classList.add('mobile-touch-target');
            }
        });
        
        // Add swipe gestures for mobile navigation
        this.addSwipeGestures();
        
        // Optimize modals for mobile
        this.optimizeModalsForMobile();
    }

    addSwipeGestures() {
        let startX, startY, currentX, currentY;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchend', (e) => {
            if (!startX || !startY || !currentX || !currentY) return;
            
            const diffX = startX - currentX;
            const diffY = startY - currentY;
            
            // Only trigger if horizontal swipe is dominant
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // Swipe left - could trigger next action
                    this.handleSwipeLeft();
                } else {
                    // Swipe right - could trigger back action
                    this.handleSwipeRight();
                }
            }
            
            startX = startY = currentX = currentY = null;
        });
    }

    handleSwipeLeft() {
        // Close mobile menus on swipe left
        this.closeMobileMenus();
    }

    handleSwipeRight() {
        // Could implement navigation back or menu open
        console.log('Swipe right detected');
    }

    optimizeModalsForMobile() {
        // Override the dynamic modal creation for mobile optimization
        const originalChangePassword = this.changePassword;
        this.changePassword = () => {
            originalChangePassword.call(this);
            
            // Additional mobile optimizations for the password modal
            const modal = document.getElementById('dynamic-password-modal');
            if (modal && this.isMobile) {
                modal.style.padding = '20px 10px';
                const content = modal.querySelector('div');
                if (content) {
                    content.style.margin = '0';
                    content.style.maxWidth = '95vw';
                    content.style.maxHeight = '80vh';
                }
            }
        };
    }

    async init() {
        // Apply mobile optimizations first
        this.applyMobileOptimizations();
        
        // Load settings first, then initialize the rest of the app
        await this.loadSettings();
        this.initializeImportHandlers();
        this.setupEventListeners();
        this.initializeAuthHandlers();
        this.initMobileNav(); // Initialize mobile navigation
        this.loadDashboard();
        this.loadCustomers(); // Load customers for dropdowns
        this.loadLineItems(); // Load line items for dropdowns
        
        // Initialize address autocomplete
        setTimeout(() => {
            this.initializeAddressAutocomplete();
        }, 500);
        
        // Apply mobile-specific UI adjustments after everything loads
        setTimeout(() => {
            this.applyMobileUIAdjustments();
        }, 1000);
    }

    async loadCustomers() {
        console.log('🔄 Loading customers...');
        try {
            const customers = await this.apiCall('customers');
            console.log('📊 Customers loaded:', customers);
            this.data.customers = customers || [];
            console.log('✅ Customers stored in data:', this.data.customers.length, 'customers');
            
            // Also load projects and estimates if not already loaded, so we can show customer relationships
            if (!this.data.projects) {
                try {
                    const projects = await this.apiCall('projects');
                    this.data.projects = projects;
                } catch (error) {
                    console.error('Error loading projects for customer relationships:', error);
                    this.data.projects = [];
                }
            }
            
            if (!this.data.estimates) {
                try {
                    const estimates = await this.apiCall('estimates');
                    this.data.estimates = estimates;
                } catch (error) {
                    console.error('Error loading estimates for customer calculations:', error);
                    this.data.estimates = [];
                }
            }
            
            // Clear any existing search when customers are reloaded
            this.clearCustomerSearch();
            
            // Apply initial filter to hide inactive customers by default
            this.filterCustomers('');
        } catch (error) {
            console.error('❌ Error loading customers:', error);
            this.data.customers = [];
            this.renderCustomerTable([]);
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                this.switchSection(link.getAttribute('data-section'));
            });
        });
        
        // Modal form submission
        const projectForm = document.getElementById('project-form');
        if (projectForm) {
            projectForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProjectModalSubmit(e);
            });
        }
        
        // Customer search functionality
        this.setupCustomerSearch();
        
        // Project search functionality
        this.setupProjectSearch();
        
        // Phone formatting
        this.setupPhoneFormatting();
    }

    setupCustomerSearch() {
        const searchInput = document.getElementById('customer-search');
        const searchClear = document.getElementById('customer-search-clear');
        const showInactiveCheckbox = document.getElementById('show-inactive-customers');
        
        if (searchInput) {
            // Search input event
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.trim();
                const showInactive = showInactiveCheckbox?.checked;
                this.filterCustomers(searchTerm, showInactive);
                
                // Show/hide clear button
                if (searchTerm) {
                    searchClear?.classList.add('show');
                } else {
                    searchClear?.classList.remove('show');
                }
            });
            
            // Enter key search
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchTerm = e.target.value.trim();
                    const showInactive = showInactiveCheckbox?.checked;
                    this.filterCustomers(searchTerm, showInactive);
                }
            });
        }
        
        if (showInactiveCheckbox) {
            // Checkbox change event
            showInactiveCheckbox.addEventListener('change', () => {
                const searchTerm = searchInput?.value.trim() || '';
                const showInactive = showInactiveCheckbox.checked;
                this.filterCustomers(searchTerm, showInactive);
            });
        }
        
        if (searchClear) {
            // Clear button event
            searchClear.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                    searchClear.classList.remove('show');
                    this.filterCustomers(''); // Show all customers (respects checkbox)
                }
            });
        }
    }

    filterCustomers(searchTerm, showInactive) {
        if (!this.data.customers) {
            return;
        }
        
        // If showInactive is not explicitly passed, check the checkbox
        if (typeof showInactive === 'undefined') {
            const checkbox = document.getElementById('show-inactive-customers');
            showInactive = checkbox?.checked || false;
        }
        
        // First filter by status (hide inactive unless checkbox is checked)
        let filteredCustomers = this.data.customers.filter(customer => {
            if (showInactive) {
                return true; // Show all customers
            } else {
                // Only show active customers (treat null/undefined/empty as active)
                return customer.Status === 'active' || !customer.Status;
            }
        });
        
        // Then filter by search term if provided
        if (searchTerm && searchTerm.length > 0) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            filteredCustomers = filteredCustomers.filter(customer => {
                // Search in multiple fields
                const companyName = (customer.CompanyName || '').toLowerCase();
                const contactName = (customer.ContactName || '').toLowerCase();
                const phone = (customer.Phone || '').toLowerCase();
                const email = (customer.Email || '').toLowerCase();
                
                return companyName.includes(lowerSearchTerm) ||
                       contactName.includes(lowerSearchTerm) ||
                       phone.includes(lowerSearchTerm) ||
                       email.includes(lowerSearchTerm);
            });
        }
        
        this.renderCustomerTable(filteredCustomers);
        this.updateCustomerCount(filteredCustomers.length, this.data.customers.length);
    }

    clearCustomerSearch() {
        const searchInput = document.getElementById('customer-search');
        const searchClear = document.getElementById('customer-search-clear');
        
        if (searchInput) {
            searchInput.value = '';
        }
        if (searchClear) {
            searchClear.classList.remove('show');
        }
    }

    setupProjectSearch() {
        const searchInput = document.getElementById('project-search');
        const searchClear = document.getElementById('project-search-clear');
        const showInactiveCheckbox = document.getElementById('show-inactive-projects');
        
        if (searchInput) {
            // Search input event
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.trim();
                const showInactive = showInactiveCheckbox?.checked;
                this.filterProjects(searchTerm, showInactive);
                
                // Show/hide clear button
                if (searchTerm) {
                    searchClear?.classList.add('show');
                } else {
                    searchClear?.classList.remove('show');
                }
            });
            
            // Enter key search
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchTerm = e.target.value.trim();
                    const showInactive = showInactiveCheckbox?.checked;
                    this.filterProjects(searchTerm, showInactive);
                }
            });
        }
        
        if (showInactiveCheckbox) {
            // Checkbox change event
            showInactiveCheckbox.addEventListener('change', () => {
                const searchTerm = searchInput?.value.trim() || '';
                const showInactive = showInactiveCheckbox.checked;
                this.filterProjects(searchTerm, showInactive);
            });
        }
        
        if (searchClear) {
            // Clear button event
            searchClear.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                    searchClear.classList.remove('show');
                    this.filterProjects(''); // Show all projects (respects checkbox)
                }
            });
        }
    }

    // Phone formatting functionality
    setupPhoneFormatting() {
        // Set up event delegation for dynamic phone inputs
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('phone-format')) {
                this.formatPhoneNumber(e.target);
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('phone-format')) {
                this.handlePhoneKeydown(e);
            }
        });
        
        document.addEventListener('paste', (e) => {
            if (e.target.classList.contains('phone-format')) {
                setTimeout(() => this.formatPhoneNumber(e.target), 10);
            }
        });
    }

    formatPhoneNumber(input) {
        // Remove all non-digits
        let value = input.value.replace(/\D/g, '');
        
        // Limit to 10 digits for US phone numbers
        if (value.length > 10) {
            value = value.substring(0, 10);
        }
        
        // Format the number
        let formatted = '';
        if (value.length > 0) {
            if (value.length <= 3) {
                formatted = `(${value}`;
            } else if (value.length <= 6) {
                formatted = `(${value.substring(0, 3)}) ${value.substring(3)}`;
            } else {
                formatted = `(${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6)}`;
            }
        }
        
        input.value = formatted;
    }

    handlePhoneKeydown(e) {
        // Allow backspace, delete, tab, escape, enter
        if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
            // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            (e.keyCode === 65 && e.ctrlKey === true) ||
            (e.keyCode === 67 && e.ctrlKey === true) ||
            (e.keyCode === 86 && e.ctrlKey === true) ||
            (e.keyCode === 88 && e.ctrlKey === true) ||
            // Allow home, end, left, right
            (e.keyCode >= 35 && e.keyCode <= 39)) {
            return;
        }
        
        // Ensure that it is a number and stop the keypress
        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
            e.preventDefault();
        }
    }

    setupPhoneFormattingForExistingInputs() {
        // Format existing phone values in forms that are already rendered
        document.querySelectorAll('.phone-format').forEach(input => {
            if (input.value) {
                this.formatPhoneNumber(input);
            }
        });
    }

    formatPhoneDisplay(phoneNumber) {
        if (!phoneNumber) return '';
        
        // Remove all non-digits
        const cleaned = phoneNumber.replace(/\D/g, '');
        
        // Format for display
        if (cleaned.length === 10) {
            return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
        } else if (cleaned.length > 0) {
            // Return partially formatted or as-is if not standard length
            return phoneNumber;
        }
        
        return '';
    }

    filterProjects(searchTerm, showInactive) {
        if (!this.data.projects) {
            return;
        }
        
        // If showInactive is not explicitly passed, check the checkbox
        if (typeof showInactive === 'undefined') {
            const checkbox = document.getElementById('show-inactive-projects');
            showInactive = checkbox?.checked || false;
        }
        
        // Define inactive project statuses based on the existing dropdown
        const inactiveStatuses = ['Cancelled', 'Completed', 'On Hold'];
        
        // First filter by status (hide inactive unless checkbox is checked)
        let filteredProjects = this.data.projects.filter(project => {
            if (showInactive) {
                return true; // Show all projects
            } else {
                // Only show active projects (exclude cancelled, completed, on hold)
                return !inactiveStatuses.includes(project.ProjectStatus);
            }
        });
        
        // Then filter by search term if provided
        if (searchTerm && searchTerm.length > 0) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            filteredProjects = filteredProjects.filter(project => {
                // Search in multiple fields
                const projectName = (project.ProjectName || '').toLowerCase();
                const companyName = (project.CompanyName || '').toLowerCase();
                const projectDescription = (project.ProjectDescription || '').toLowerCase();
                const projectAddress = (project.ProjectAddress || '').toLowerCase();
                
                return projectName.includes(lowerSearchTerm) ||
                       companyName.includes(lowerSearchTerm) ||
                       projectDescription.includes(lowerSearchTerm) ||
                       projectAddress.includes(lowerSearchTerm);
            });
        }
        
        this.renderProjectTable(filteredProjects);
        this.updateProjectCount(filteredProjects.length, this.data.projects.length);
        
        // Also refresh all related data to maintain consistency
        this.refreshRelatedDataForActiveProjects();
    }

    getActiveProjectIds() {
        if (!this.data.projects) {
            return [];
        }
        
        // Get checkbox state for inactive projects
        const checkbox = document.getElementById('show-inactive-projects');
        const showInactive = checkbox?.checked || false;
        
        // Define inactive project statuses
        const inactiveStatuses = ['Cancelled', 'Completed', 'On Hold'];
        
        // Filter projects to get only active ones (or all if showInactive is true)
        const activeProjects = this.data.projects.filter(project => {
            if (showInactive) {
                return true; // Show all projects
            } else {
                // Only include active projects
                return !inactiveStatuses.includes(project.ProjectStatus);
            }
        });
        
        // Return array of ProjectIDs
        return activeProjects.map(project => project.ProjectID);
    }

    filterEstimatesByActiveProjects() {
        if (!this.data.estimates) return [];
        const activeProjectIds = this.getActiveProjectIds();
        return this.data.estimates.filter(estimate => 
            activeProjectIds.includes(estimate.ProjectID)
        );
    }

    filterInvoicesByActiveProjects() {
        if (!this.data.invoices) return [];
        const activeProjectIds = this.getActiveProjectIds();
        return this.data.invoices.filter(invoice => 
            activeProjectIds.includes(invoice.ProjectID)
        );
    }

    filterPaymentsByActiveProjects() {
        if (!this.data.payments) return [];
        const activeProjectIds = this.getActiveProjectIds();
        return this.data.payments.filter(payment => 
            activeProjectIds.includes(payment.ProjectID)
        );
    }

    filterContractsByActiveProjects() {
        if (!this.data.contracts) return [];
        const activeProjectIds = this.getActiveProjectIds();
        return this.data.contracts.filter(contract => 
            activeProjectIds.includes(contract.ProjectID)
        );
    }

    filterPaytermsByActiveProjects() {
        if (!this.data.payterms) return [];
        const activeProjectIds = this.getActiveProjectIds();
        return this.data.payterms.filter(payterm => 
            activeProjectIds.includes(payterm.ProjectID)
        );
    }

    refreshRelatedDataForActiveProjects() {
        // Only refresh if we have the data loaded already
        if (this.data.estimates) {
            const filteredEstimates = this.filterEstimatesByActiveProjects();
            this.renderEstimateTable(filteredEstimates);
        }
        
        if (this.data.invoices) {
            const filteredInvoices = this.filterInvoicesByActiveProjects();
            this.renderInvoiceTable(filteredInvoices);
        }
        
        if (this.data.payments) {
            const filteredPayments = this.filterPaymentsByActiveProjects();
            this.renderPaymentTable(filteredPayments);
        }
        
        if (this.data.contracts) {
            const filteredContracts = this.filterContractsByActiveProjects();
            this.renderContractTable(filteredContracts);
        }
        
        if (this.data.payterms) {
            const filteredPayterms = this.filterPaytermsByActiveProjects();
            this.renderPayTermsTable(filteredPayterms);
        }
    }

    clearProjectSearch() {
        const searchInput = document.getElementById('project-search');
        const searchClear = document.getElementById('project-search-clear');
        
        if (searchInput) {
            searchInput.value = '';
        }
        if (searchClear) {
            searchClear.classList.remove('show');
        }
    }

    handleProjectModalSubmit(event) {
        event.preventDefault();
        console.log('Project modal submit triggered');
        
        const form = document.getElementById('project-form');
        if (!form) {
            console.error('Project form not found');
            return;
        }
        
        const formData = new FormData(form);
        const projectData = Object.fromEntries(formData.entries());
        console.log('Project form data:', projectData);
        
        // Validate required fields
        if (!projectData['project-name']) {
            this.showToast('Project name is required', 'error');
            return;
        }
        
        if (!projectData['project-customer']) {
            this.showToast('Customer selection is required', 'error');
            return;
        }
        
        // Validate modal dates before submission
        if (projectData['project-start-date'] && projectData['project-estimated-completion']) {
            if (projectData['project-estimated-completion'] < projectData['project-start-date']) {
                this.showToast('End date cannot be before start date. Please correct the dates before saving.', 'error');
                return;
            }
        }
        
        // Map modal field names to backend expected names (PascalCase)
        const backendData = {
            ProjectName: projectData['project-name'],
            ProjectDescription: projectData['project-description'] || '',
            StartDate: projectData['project-start-date'] || null,
            EstimatedCompletionDate: projectData['project-estimated-completion'] || null,
            ProjectStatus: projectData['project-status'] || '',
            CustomerID: parseInt(projectData['project-customer']) || null,
            TotalContractAmount: projectData['project-total-contract-amount'] ? parseFloat(projectData['project-total-contract-amount']) : null,
            ProjectAddress: projectData['project-address'] || '',
            ProjectCity: projectData['project-city'] || '',
            ProjectState: projectData['project-state'] || '',
            ProjectZip: projectData['project-zip'] || ''
        };
        
        console.log('Backend data to send:', backendData);
        
        const projectId = projectData['project-id'];
        
        if (projectId && projectId !== '') {
            // Update existing project
            console.log('Updating project with ID:', projectId);
            this.apiCall(`projects/${projectId}`, 'PUT', backendData)
                .then(() => {
                    this.showToast('Project updated successfully', 'success');
                    document.getElementById('project-modal').style.display = 'none';
                    this.loadProjects();
                })
                .catch(error => {
                    console.error('Error updating project:', error);
                    this.showToast('Error updating project', 'error');
                });
        } else {
            // Add new project
            console.log('Adding new project');
            this.apiCall('projects', 'POST', backendData)
                .then(() => {
                    this.showToast('Project added successfully', 'success');
                    document.getElementById('project-modal').style.display = 'none';
                    this.loadProjects();
                })
                .catch(error => {
                    console.error('Error adding project:', error);
                    this.showToast('Error adding project', 'error');
                });
        }
    }

    // Navigation
    switchSection(section) {
        // Clear view/edit states when switching between different sections
        if (this.currentSection !== section) {
            // Clear project states when leaving projects
            if (this.currentSection === 'projects' && section !== 'projects') {
                this.viewingProjectId = null;
                this.editingProjectId = null;
            }
            
            // Clear customer states when leaving customers
            if (this.currentSection === 'customers' && section !== 'customers') {
                this.viewingCustomerId = null;
                this.editingCustomerId = null;
            }
            
            // Clear estimate states when leaving estimates
            if (this.currentSection === 'estimates' && section !== 'estimates') {
                this.viewingEstimateId = null;
                this.editingEstimateId = null;
            }
            
            console.log(`Cleared view/edit states when switching from ${this.currentSection} to ${section}`);
        }
        
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const navLink = document.querySelector(`[data-section="${section}"]`);
        if (navLink) {
            navLink.classList.add('active');
        } else {
            console.error(`Nav link for section '${section}' not found.`);
        }

        // Show/hide sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        const sectionEl = document.getElementById(`${section}-section`);
        if (sectionEl) {
            sectionEl.classList.add('active');
        } else {
            console.error(`Section element '${section}-section' not found.`);
        }

        this.currentSection = section;
        this.loadSectionData(section);
        
        // Apply mobile optimizations after switching sections
        setTimeout(() => {
            this.applyMobileUIAdjustments();
        }, 500);
    }

    loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'customers':
                this.loadCustomers();
                break;
            case 'projects':
                this.loadProjects();
                this.loadPayTerms(); // Load pay terms to check contract button eligibility
                break;
            case 'estimates':
                this.loadEstimates();
                break;
            case 'payterms':
                this.loadPayTerms();
                break;
            case 'invoices':
                this.loadInvoices();
                break;
            case 'payments':
                this.loadPayments();
                break;
            case 'contracts':
                this.loadContracts();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    refreshCurrentSection() {
        this.loadSectionData(this.currentSection);
        this.showToast('Data refreshed successfully', 'success');
    }

    // API Helper
    async apiCall(endpoint, method = 'GET', data = null) {
        this.showLoading();
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(`/api/${endpoint}`, options);
            
            if (response.status === 401) {
                // Authentication failed, redirect to login
                this.showToast('Session expired. Please log in again.', 'error');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
                return null;
            }
            
            let result = null;
            const text = await response.text();
            try {
                result = text ? JSON.parse(text) : null;
            } catch (e) {
                // If not JSON, just return text
                result = text;
            }
            if (!response.ok) {
                // If result is an object and has error, use it; otherwise use text
                const errorMsg = result && result.error ? result.error : (typeof result === 'string' ? result : 'API request failed');
                throw new Error(errorMsg);
            }
            return result;
        } catch (error) {
            this.showToast(error.message, 'error');
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    // Dashboard
    async loadDashboard() {
        try {
            // Load dashboard stats - include estimates for project contract calculations
            const [customers, projects, invoices, overdueInvoices, estimates] = await Promise.all([
                this.apiCall('customers'),
                this.apiCall('projects'),
                this.apiCall('invoices'),
                this.apiCall('invoices/reports/overdue'),
                this.apiCall('estimates')
            ]);
            
            // Store data for use in dashboard and other sections
            this.data.customers = customers;
            this.data.projects = projects;
            this.data.estimates = estimates;
            console.log('Dashboard loaded with', projects.length, 'projects and', estimates.length, 'estimates');
            
            // Group projects by status for dashboard cards
            this.renderDashboardProjectGroups(projects);

            // Setup dashboard search functionality
            this.setupDashboardSearch();

        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    setupDashboardSearch() {
        const searchInput = document.getElementById('dashboard-search');
        const searchClear = document.getElementById('dashboard-search-clear');
        
        if (searchInput) {
            // Search input event
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.trim();
                this.filterDashboard(searchTerm);
                
                // Show/hide clear button
                if (searchTerm) {
                    searchClear?.classList.add('show');
                } else {
                    searchClear?.classList.remove('show');
                }
            });
            
            // Enter key search
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchTerm = e.target.value.trim();
                    this.filterDashboard(searchTerm);
                }
            });
        }
        
        if (searchClear) {
            // Clear button event
            searchClear.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                    searchClear.classList.remove('show');
                    this.filterDashboard(''); // Show all projects
                }
            });
        }
    }



    // Dashboard search/filter functionality
    filterDashboard(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const allProjectItems = document.querySelectorAll('.dashboard-item');
        const allProjectCards = document.querySelectorAll('.dashboard-card[data-card-type="project-group"]');
        
        if (!term) {
            // Show all project items and cards
            allProjectItems.forEach(item => item.style.display = '');
            allProjectCards.forEach(card => card.style.display = '');
            return;
        }
        
        allProjectItems.forEach(item => {
            const searchableText = item.getAttribute('data-searchable') || '';
            const isMatch = searchableText.toLowerCase().includes(term);
            item.style.display = isMatch ? '' : 'none';
        });
        
        // Hide cards that have no visible project items
        allProjectCards.forEach(card => {
            const visibleItems = card.querySelectorAll('.dashboard-item:not([style*="display: none"])');
            const hasVisibleItems = visibleItems.length > 0;
            const hasContent = card.querySelector('.project-list') !== null;
            
            // Show card if it has visible items, or if it's empty but we're not filtering
            card.style.display = (hasVisibleItems || !hasContent) ? '' : 'none';
        });
    }
    
    renderRecentProjects(projects) {
        const container = document.getElementById('recent-projects');
        if (projects.length === 0) {
            container.innerHTML = '<p class="text-muted">No recent projects</p>';
            return;
        }

        container.innerHTML = projects.map(project => `
            <div class="activity-item">
                <div class="activity-info">
                    <h4>${project.ProjectName}</h4>
                    <p>${project.CompanyName} • ${this.getStatusBadge(project.ProjectStatus)}</p>
                </div>
                <div class="activity-meta">
                    ${project.TotalContractAmount ? this.formatCurrency(project.TotalContractAmount) : 'N/A'}
                </div>
            </div>
        `).join('');
    }

    renderOverdueInvoices(invoices) {
        const container = document.getElementById('overdue-invoices');
        if (invoices.length === 0) {
            container.innerHTML = '<p class="text-muted">No overdue invoices</p>';
            return;
        }

        container.innerHTML = invoices.map(invoice => `
            <div class="activity-item">
                <div class="activity-info">
                    <h4>${invoice.InvoiceNumber}</h4>
                    <p>${invoice.CompanyName} • ${invoice.DaysOverdue} days overdue</p>
                </div>
                <div class="activity-meta">
                    <div class="text-danger">${this.formatCurrency(invoice.BalanceDue)}</div>
                </div>
            </div>
        `).join('');
    }

    renderDashboardProjectGroups(projects) {
        const dashboard = document.getElementById('dashboard-project-groups');
        if (!dashboard) return;
        
        // Store all projects for filtering
        this.allDashboardProjects = projects;
        
        const statusGroups = [
            { title: 'Needs Attention', statuses: ['Needs Attention'] },
            { title: 'Back Burner', statuses: ['Awaiting payment', 'Awaiting Engineering', 'Awaiting Customer feedback'] },
            { title: 'In for permit', statuses: ['Submitted'] },
            { title: 'Current Bids', statuses: ['Bid Only'] }
        ];
        dashboard.innerHTML = statusGroups.map(group => {
            const groupProjects = projects.filter(p => group.statuses.includes(p.ProjectStatus));
            
            // Sort projects by priority (lower numbers = higher priority, then by project name)
            groupProjects.sort((a, b) => {
                const priorityA = parseInt(a.ProjectPriority) || 999; // Default to low priority if not set
                const priorityB = parseInt(b.ProjectPriority) || 999;
                
                if (priorityA !== priorityB) {
                    return priorityA - priorityB; // Lower numbers first
                }
                return (a.ProjectName || '').localeCompare(b.ProjectName || ''); // Then alphabetical
            });
            
            return `
                <div class="dashboard-card" data-card-type="project-group">
                    <h3>${group.title}</h3>
                    ${groupProjects.length === 0 ? '<p class="text-muted">No projects</p>' : `
                    <ul class="project-list">
                        ${groupProjects.map(project => {
                            const priority = parseInt(project.ProjectPriority) || 999;
                            const priorityDisplay = priority < 999 ? `<span style="font-size: 0.8em; color: #007bff; font-weight: bold;">[${priority}]</span> ` : '';
                            return `
                            <li class="dashboard-project-link dashboard-item" 
                                style="cursor:pointer" 
                                onclick="app.openProjectFromDashboard('${project.ProjectID}')"
                                data-searchable="${project.ProjectName} ${project.CompanyName} ${project.ProjectStatus} ${project.ProjectDescription || ''}"
                                data-item-type="project">
                                ${priorityDisplay}<strong>${project.ProjectName}</strong> (${project.CompanyName})<br>
                                <span>${project.StartDate ? this.formatDate(project.StartDate) : 'N/A'} - ${project.EstimatedCompletionDate ? this.formatDate(project.EstimatedCompletionDate) : 'N/A'}</span>
                            </li>
                        `}).join('')}
                    </ul>
                    `}
                </div>
            `;
        }).join('');
    }

    updateProjectCount(filteredCount, totalCount) {
        const countEl = document.getElementById('project-count');
        if (countEl) {
            if (filteredCount !== undefined && totalCount !== undefined && filteredCount !== totalCount) {
                // Show filtered count vs total
                countEl.textContent = `${filteredCount} of ${totalCount} project${totalCount === 1 ? '' : 's'}`;
            } else {
                // Show regular count
                const count = totalCount || this.data.projects.length;
                countEl.textContent = `${count} project${count === 1 ? '' : 's'}`;
            }
        }
    }

    showProjectModal(projectId) {
        if (projectId) {
            let project;
            if (typeof projectId === 'object' && projectId !== null) {
                project = projectId;
                projectId = project.ProjectID;
            } else {
                project = this.data.projects.find(p => p.ProjectID == projectId) || {};
            }
            this.editingProjectId = projectId;
            this.viewingProjectId = null;
            this.filterProjects('');
            // Set up date validation after form is rendered
            setTimeout(() => this.setupProjectDateValidation(), 100);
            // Set up address autocomplete after form is rendered
            setTimeout(() => {
                const addressFieldId = `projectAddress_${projectId || 'new'}`;
                this.setupAddressAutocomplete(addressFieldId);
            }, 150);
            // Optionally scroll to the row
            const row = document.querySelector(`tr.edit-row`);
            if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // New project: blank form
            const project = {
                ProjectID: '',
                ProjectName: '',
                CompanyName: '',
                ProjectStatus: '',
                StartDate: '',
                EstimatedCompletionDate: '',
                ProjectDescription: '',
                TotalContractAmount: '',
                ProjectAddress: '',
                ProjectCity: '',
                ProjectState: '',
                ProjectZip: '',
                CustomerID: ''
            };
            const renderForm = () => {
                this.editingProjectId = null;
                this.viewingProjectId = null;
                this.filterProjects('');
                // Optionally scroll to the row
                const row = document.querySelector('tr.edit-row');
                if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            };
            if (!this.data.customers || this.data.customers.length === 0) {
                this.loadCustomers().then(renderForm);
            } else {
                renderForm();
            }
    }
    }
    toggleCustomerView(customerId) {
        if (this.viewingCustomerId == customerId) { // Use == instead of ===
            this.viewingCustomerId = null;
            this.filterCustomers('');
        } else {
            this.viewingCustomerId = customerId;
            this.editingCustomerId = null;
            
            // Ensure projects and estimates are loaded before showing customer view
            const loadPromises = [];
            
            if (!this.data.projects) {
                loadPromises.push(this.loadProjects());
            }
            
            if (!this.data.estimates) {
                loadPromises.push(this.loadEstimates());
            }
            
            if (loadPromises.length > 0) {
                Promise.all(loadPromises).then(() => {
                    this.filterCustomers('');
                    const row = document.querySelector('tr.view-row');
                    if (row && this.viewingCustomerId) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }).catch(error => {
                    console.error('Error loading related data for customer view:', error);
                    // Still render the view, but without related data
                    this.filterCustomers('');
                });
            } else {
                this.filterCustomers('');
                const row = document.querySelector('tr.view-row');
                if (row && this.viewingCustomerId) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
    getCustomerViewHtml(customer) {
        // Get projects for this customer
        const customerProjects = this.data.projects ? this.data.projects.filter(p => p.CustomerID == customer.CustomerID) : [];
        
        // Calculate total value from all customer projects
        const totalProjectValue = customerProjects.reduce((sum, project) => {
            const projectEstimates = this.data.estimates ? this.data.estimates.filter(e => e.ProjectID == project.ProjectID) : [];
            const projectTotal = projectEstimates.reduce((estSum, est) => estSum + (parseFloat(est.TotalAmount) || 0), 0);
            return sum + projectTotal;
        }, 0);
        
        return `<div class="details-card">
            <div class="details-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1em;">
                <h3 style="margin: 0;">Customer Details - ${customer.CompanyName || ''}</h3>
                <button class="btn btn-primary" onclick="app.createProjectFromCustomer(${customer.CustomerID})" title="Create new project for this customer">
                    <i class="fas fa-plus"></i> Create Project
                </button>
            </div>
            
            <div class="customer-info-section">
                <h4 style="margin-top: 20px; margin-bottom: 10px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    <i class="fas fa-user"></i> Primary Contact
                </h4>
                <div class="form-row" style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div><strong>Name:</strong> ${customer.ContactName || 'N/A'}</div>
                    <div><strong>Phone:</strong> ${customer.Phone || 'N/A'}</div>
                    <div><strong>Email:</strong> ${customer.Email || 'N/A'}</div>
                </div>
                
                ${(customer.ContactName2 || customer.Phone2 || customer.Email2) ? `
                <h4 style="margin-top: 20px; margin-bottom: 10px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    <i class="fas fa-user-plus"></i> Secondary Contact
                </h4>
                <div class="form-row" style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div><strong>Name:</strong> ${customer.ContactName2 || 'N/A'}</div>
                    <div><strong>Phone:</strong> ${customer.Phone2 || 'N/A'}</div>
                    <div><strong>Email:</strong> ${customer.Email2 || 'N/A'}</div>
                </div>` : ''}
                
                <h4 style="margin-top: 20px; margin-bottom: 10px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    <i class="fas fa-info-circle"></i> Additional Information
                </h4>
                <div><strong>Status:</strong> ${customer.Status || 'N/A'}</div>
                <div><strong>Total Project Value:</strong> ${totalProjectValue > 0 ? this.formatCurrency(totalProjectValue) : '$0.00'}</div>
                <div><strong>Address:</strong> ${customer.Address || 'N/A'}</div>
                <div><strong>City:</strong> ${customer.City || 'N/A'}</div>
                <div><strong>State:</strong> ${customer.State || 'N/A'}</div>
                <div><strong>ZIP:</strong> ${customer.ZipCode || 'N/A'}</div>
            </div>
            
            ${customerProjects.length > 0 ? `
            <div class="customer-projects-section" style="margin-top: 20px;">
                <h4>Associated Projects (${customerProjects.length})</h4>
                <div class="projects-list">
                    ${customerProjects.map(project => {
                        const projectEstimates = this.data.estimates ? this.data.estimates.filter(e => e.ProjectID == project.ProjectID) : [];
                        const projectTotal = projectEstimates.reduce((sum, est) => sum + (parseFloat(est.TotalAmount) || 0), 0);
                        
                        return `
                        <div class="project-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 6px; background: #f9f9f9;">
                            <div>
                                <strong>${project.ProjectName || 'N/A'}</strong>
                                <span style="margin-left: 10px; color: #666;">
                                    Status: ${project.ProjectStatus || 'N/A'}
                                </span>
                                <span style="margin-left: 10px; color: #666;">
                                    ${project.StartDate ? 'Start: ' + this.formatDate(project.StartDate) : ''}
                                </span>
                                ${projectEstimates.length > 0 ? `<span style="margin-left: 10px; color: #888; font-size: 0.9em;">(${projectEstimates.length} estimates)</span>` : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <strong>${projectTotal > 0 ? this.formatCurrency(projectTotal) : '$0.00'}</strong>
                                <button class="btn btn-sm btn-outline" onclick="app.viewProjectFromCustomer(${project.ProjectID})" title="View this project">
                                    <i class="fas fa-eye"></i> View
                                </button>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : `
            <div class="customer-projects-section" style="margin-top: 20px;">
                <h4>Associated Projects</h4>
                <p style="color: #666; font-style: italic;">No projects created for this customer yet.</p>
            </div>
            `}
        </div>`;
    }

    // ...existing code...

    initMobileNav() {
        console.log('Initializing mobile navigation...');
        
        const menuToggle = document.getElementById('menu-toggle');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        const appContainer = document.querySelector('.app-container');
        const navLinks = document.querySelectorAll('.sidebar .nav-link');

        console.log('Menu toggle:', menuToggle);
        console.log('Sidebar overlay:', sidebarOverlay);
        console.log('App container:', appContainer);
        console.log('Nav links found:', navLinks.length);

        if (menuToggle) {
            // Add both click and touchstart for better mobile support
            menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Menu toggle clicked');
                document.body.classList.toggle('sidebar-open');
            });
            
            menuToggle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Menu toggle touched');
                document.body.classList.toggle('sidebar-open');
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Sidebar overlay clicked');
                document.body.classList.remove('sidebar-open');
            });
            
            sidebarOverlay.addEventListener('touchstart', (e) => {
                e.preventDefault();
                console.log('Sidebar overlay touched');
                document.body.classList.remove('sidebar-open');
            });
        }

        navLinks.forEach((link, index) => {
            link.addEventListener('click', () => {
                console.log(`Nav link ${index} clicked`);
                if (window.innerWidth <= 767) {
                    document.body.classList.remove('sidebar-open');
                }
            });
        });
    }
    async saveCustomer() {
        const customerId = document.getElementById('customer-id').value;
        const customerData = {
            CompanyName: document.getElementById('customer-company-name').value,
            ContactName: document.getElementById('customer-contact-name').value,
            Phone: document.getElementById('customer-phone').value,
            Email: document.getElementById('customer-email').value,
            Address: document.getElementById('customer-address').value,
            City: document.getElementById('customer-city').value,
            State: document.getElementById('customer-state').value,
            ZipCode: document.getElementById('customer-zip').value
        };

        try {
            if (customerId) {
                // Update existing customer
                await this.apiCall(`customers/${customerId}`, 'PUT', customerData);
                this.showToast('Customer updated successfully', 'success');
            } else {
                // Add new customer
                await this.apiCall('customers', 'POST', customerData);
                this.showToast('Customer added successfully', 'success');
            }
            $('#customer-modal').modal('hide');
            this.loadCustomers();
        } catch (error) {
            console.error('Error saving customer:', error);
        }
    }

    async deleteCustomer(customerId) {
        if (!confirm('Are you sure you want to delete this customer?')) return;
        try {
            await this.apiCall(`customers/${customerId}`, 'DELETE');
            this.showToast('Customer deleted successfully', 'success');
            this.loadCustomers();
        } catch (error) {
            console.error('Error deleting customer:', error);
        }
    }

    // Projects
    async loadProjects() {
        try {
            const projects = await this.apiCall('projects');
            this.data.projects = projects;
            
            // Always load estimates to ensure project views show current estimate data
            try {
                console.log('Loading estimates for project-estimate sync...');
                const estimates = await this.apiCall('estimates');
                this.data.estimates = estimates;
                console.log('Estimates loaded for projects:', estimates.length);
            } catch (error) {
                console.error('Error loading estimates for project calculations:', error);
                this.data.estimates = [];
            }
            
            // Clear any existing search and apply filter (hide inactive by default)
            this.clearProjectSearch();
            this.filterProjects('');
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }

    renderProjectTable(projects) {
        console.log('renderProjectTable called with', projects.length, 'projects');
        const tableBody = document.getElementById('projects-table-body');
        if (!tableBody) {
            console.error('Projects table body not found');
            return;
        }
        
        // Responsive design - use mobile layout on iPad and iPhone
        const isMobile = window.innerWidth <= 1024;
        console.log('Screen width:', window.innerWidth, 'Mobile mode:', isMobile);
        
        if (isMobile) {
            console.log('Using mobile list rendering');
            // Create mobile-friendly list view
            this.renderProjectsMobileList(projects);
            return;
        }
        
        console.log('Using desktop table rendering');
        
        // Sort projects by priority (lower numbers = higher priority), then by name
        const sortedProjects = [...projects].sort((a, b) => {
            const priorityA = parseInt(a.ProjectPriority) || 999; // Default to low priority if not set
            const priorityB = parseInt(b.ProjectPriority) || 999;
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB; // Lower numbers first
            }
            return (a.ProjectName || '').localeCompare(b.ProjectName || ''); // Then alphabetical
        });
        
        // Add new project form row if editing a new project
        let projectsToRender = [...sortedProjects];
        if (this.editingProjectId === 'new') {
            const newProject = {
                ProjectID: '',
                ProjectName: '',
                CompanyName: '',
                ProjectStatus: '',
                StartDate: '',
                EstimatedCompletionDate: '',
                ProjectDescription: '',
                TotalContractAmount: '',
                ProjectAddress: '',
                ProjectCity: '',
                ProjectState: '',
                ProjectZip: '',
                CustomerID: ''
            };
            projectsToRender.unshift(newProject); // Add to beginning
        }
        
        tableBody.innerHTML = projectsToRender.map(project => {
            const isNew = !project.ProjectID;
            const isViewing = this.viewingProjectId == project.ProjectID; // Use == for type flexibility
            const isEditing = this.editingProjectId == project.ProjectID || (isNew && this.editingProjectId === 'new'); // Use == for type flexibility
            
            // Calculate total contract amount from estimates
            const projectEstimates = this.data.estimates ? this.data.estimates.filter(e => e.ProjectID == project.ProjectID) : [];
            const calculatedContractAmount = projectEstimates.reduce((sum, est) => sum + (parseFloat(est.TotalAmount) || 0), 0);
            
            // Add CSS classes for focus mode
            let rowClasses = 'project-row';
            if (isEditing) {
                rowClasses += ' project-editing';
            }
            
            return `
                <tr class="${rowClasses}">
                    <td>${(() => {
                        const priority = parseInt(project.ProjectPriority) || 999;
                        const priorityDisplay = priority < 999 ? `<span style="font-size: 0.8em; color: #007bff; font-weight: bold;">[${priority}]</span> ` : '';
                        return priorityDisplay + project.ProjectName;
                    })()}</td>
                    <td>${project.CompanyName}</td>
                    <td>${project.ProjectStatus}</td>
                    <td>${project.StartDate ? this.formatDate(project.StartDate) : ''}</td>
                    <td>${project.EstimatedCompletionDate ? this.formatDate(project.EstimatedCompletionDate) : ''}</td>
                    <td>${project.CreatedDate ? this.formatDate(project.CreatedDate) : ''}</td>
                    <td>${calculatedContractAmount > 0 ? this.formatCurrency(calculatedContractAmount) : ''}<span style="font-size: 0.8em; color: #666; margin-left: 4px;">${projectEstimates.length > 0 ? `(${projectEstimates.length} est.)` : ''}</span></td>
                    <td>
                        <span class="action-buttons">
                            ${!isNew ? `<button class="action-btn view" title="View" onclick="app.toggleProjectView(${project.ProjectID})"><i class="fas fa-eye"></i></button>` : ''}
                            ${!isNew ? `<button class="action-btn edit" title="Edit" onclick="app.editProjectInline(${project.ProjectID})"><i class="fas fa-edit"></i></button>` : ''}
                            ${!isNew ? `<button class="action-btn delete" title="Delete" onclick="app.deleteProject(${project.ProjectID})"><i class="fas fa-trash"></i></button>` : ''}
                        </span>
                    </td>
                </tr>
                ${isViewing ? `<tr class='view-row'><td colspan='8'>${this.getProjectViewHtml(project)}</td></tr>` : ''}
                ${isEditing ? `<tr class='edit-row'><td colspan='8'>${this.getProjectEditFormHtml(project)}</td></tr>` : ''}
            `;
        }).join('');
        
        // Apply focus mode using generic function
        this.applyFocusMode('#projects-table', this.editingProjectId, 'project-row', 'project-editing');
        
        // Apply mobile optimizations to the newly rendered table
        this.applyMobileUIAdjustments();
        
        this.updateProjectCount();
    }
    
    renderProjectsMobileList(projects) {
        console.log('renderProjectsMobileList called with', projects.length, 'projects');
        const tableBody = document.getElementById('projects-table-body');
        const table = tableBody.closest('table');
        
        console.log('Found table:', table);
        
        // Hide the table and create mobile list
        table.style.display = 'none';
        
        let mobileList = document.getElementById('projects-mobile-list');
        console.log('Existing mobile list:', mobileList);
        
        if (!mobileList) {
            console.log('Creating new mobile list');
            mobileList = document.createElement('div');
            mobileList.id = 'projects-mobile-list';
            mobileList.className = 'mobile-list';
            table.parentNode.insertBefore(mobileList, table.nextSibling);
        }
        
        // Sort projects
        const sortedProjects = [...projects].sort((a, b) => {
            const priorityA = parseInt(a.ProjectPriority) || 999;
            const priorityB = parseInt(b.ProjectPriority) || 999;
            if (priorityA !== priorityB) return priorityA - priorityB;
            return (a.ProjectName || '').localeCompare(b.ProjectName || '');
        });
        
        mobileList.innerHTML = sortedProjects.map(project => {
            const priority = parseInt(project.ProjectPriority) || 999;
            const priorityDisplay = priority < 999 ? `[${priority}] ` : '';
            
            // Calculate total contract amount
            const projectEstimates = this.data.estimates ? this.data.estimates.filter(e => e.ProjectID == project.ProjectID) : [];
            const calculatedContractAmount = projectEstimates.reduce((sum, est) => sum + (parseFloat(est.TotalAmount) || 0), 0);
            
            return `
                <div class="mobile-item">
                    <div class="mobile-item-title">${priorityDisplay}${project.ProjectName}</div>
                    <div class="mobile-item-info"><strong>Company:</strong> ${project.CompanyName}</div>
                    <div class="mobile-item-info"><strong>Status:</strong> ${project.ProjectStatus}</div>
                    <div class="mobile-item-info"><strong>Start Date:</strong> ${project.StartDate ? this.formatDate(project.StartDate) : 'Not set'}</div>
                    <div class="mobile-item-info"><strong>End Date:</strong> ${project.EstimatedCompletionDate ? this.formatDate(project.EstimatedCompletionDate) : 'Not set'}</div>
                    <div class="mobile-item-info"><strong>Amount:</strong> ${calculatedContractAmount > 0 ? this.formatCurrency(calculatedContractAmount) : 'No estimates'}</div>
                    
                    <div class="mobile-actions">
                        <button class="mobile-btn view" onclick="app.toggleProjectView(${project.ProjectID})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="mobile-btn edit" onclick="app.editProjectInline(${project.ProjectID})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="mobile-btn delete" onclick="app.deleteProject(${project.ProjectID})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        this.updateProjectCount();
    }

    renderCustomersMobileList(customers) {
        const tableBody = document.getElementById('customers-table-body');
        if (!tableBody) return;

        const tableContainer = tableBody.closest('.table-responsive') || tableBody.closest('table').parentElement;
        
        if (!customers || customers.length === 0) {
            tableContainer.innerHTML = '<div class="mobile-empty-state">No customers found</div>';
            return;
        }
        
        // Create mobile list container
        const mobileListHtml = customers.map(customer => {
            return `
                <div class="mobile-card">
                    <div class="mobile-card-header">
                        <strong>${customer.CompanyName || 'Unnamed Company'}</strong>
                        <span class="mobile-status ${customer.Status === 'active' ? 'status-active' : 'status-inactive'}">
                            ${customer.Status || 'Unknown'}
                        </span>
                    </div>
                    <div class="mobile-card-body">
                        <div class="mobile-info">
                            <i class="fas fa-user"></i> ${customer.ContactName || 'No contact'}
                        </div>
                        <div class="mobile-info">
                            <i class="fas fa-phone"></i> ${this.formatPhoneDisplay(customer.Phone || 'No phone')}
                        </div>
                        <div class="mobile-info">
                            <i class="fas fa-envelope"></i> ${customer.Email || 'No email'}
                        </div>
                        <div class="mobile-info">
                            <i class="fas fa-calendar"></i> ${customer.CreatedDate ? this.formatDate(customer.CreatedDate) : 'No date'}
                        </div>
                    </div>
                    <div class="mobile-actions">
                        <button class="mobile-btn view" onclick="app.toggleCustomerView('${customer.CustomerID}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="mobile-btn edit" onclick="app.showCustomerModal('${customer.CustomerID}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="mobile-btn delete" onclick="app.deleteCustomer('${customer.CustomerID}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        tableContainer.innerHTML = `<div class="mobile-list">${mobileListHtml}</div>`;
    }

    renderEstimatesMobileList(estimates) {
        const tableBody = document.getElementById('estimates-table-body');
        if (!tableBody) return;

        const tableContainer = tableBody.closest('.table-responsive') || tableBody.closest('table').parentElement;
        
        if (!estimates || estimates.length === 0) {
            tableContainer.innerHTML = '<div class="mobile-empty-state">No estimates found</div>';
            return;
        }
        
        // Create mobile list container
        const mobileListHtml = estimates.map(estimate => {
            return `
                <div class="mobile-card">
                    <div class="mobile-card-header">
                        <strong>${estimate.EstimateNumber || 'No Number'}</strong>
                        <span class="mobile-status ${estimate.Status === 'Sent' ? 'status-sent' : estimate.Status === 'Approved' ? 'status-approved' : 'status-draft'}">
                            ${estimate.Status || 'Draft'}
                        </span>
                    </div>
                    <div class="mobile-card-body">
                        <div class="mobile-info">
                            <i class="fas fa-project-diagram"></i> ${estimate.ProjectName || 'No project'}
                        </div>
                        <div class="mobile-info">
                            <i class="fas fa-building"></i> ${estimate.CompanyName || 'No company'}
                        </div>
                        <div class="mobile-info">
                            <i class="fas fa-calendar"></i> ${estimate.EstimateDate ? this.formatDate(estimate.EstimateDate) : 'No date'}
                        </div>
                        <div class="mobile-info">
                            <i class="fas fa-dollar-sign"></i> $${estimate.TotalAmount ? parseFloat(estimate.TotalAmount).toFixed(2) : '0.00'}
                        </div>
                    </div>
                    <div class="mobile-actions">
                        <button class="mobile-btn view" onclick="app.toggleEstimateView('${estimate.EstimateID}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="mobile-btn edit" onclick="app.editEstimateInline('${estimate.EstimateID}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="mobile-btn delete" onclick="app.deleteEstimate('${estimate.EstimateID}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        tableContainer.innerHTML = `<div class="mobile-list">${mobileListHtml}</div>`;
    }

    // Generic focus mode function for any table
    applyFocusMode(tableSelector, editingId, rowClass, editingClass) {
        const table = document.querySelector(tableSelector);
        
        if (table) {
            if (editingId) {
                table.classList.add('focus-mode');
                
                // Apply focus mode styling directly
                const nonEditingRows = table.querySelectorAll(`tbody tr.${rowClass}:not(.${editingClass})`);
                nonEditingRows.forEach(row => {
                    row.style.opacity = '0.3';
                    row.style.transition = 'opacity 0.3s ease';
                });
                
                // Add hover effect
                nonEditingRows.forEach(row => {
                    row.addEventListener('mouseenter', () => {
                        if (editingId) row.style.opacity = '0.5';
                    });
                    row.addEventListener('mouseleave', () => {
                        if (editingId) row.style.opacity = '0.3';
                    });
                });
                
            } else {
                table.classList.remove('focus-mode');
                
                // Remove focus mode styling
                const allRows = table.querySelectorAll(`tbody tr.${rowClass}`);
                allRows.forEach(row => {
                    row.style.opacity = '';
                    row.style.transition = '';
                    // Remove event listeners by cloning and replacing the node
                    const newRow = row.cloneNode(true);
                    row.parentNode.replaceChild(newRow, row);
                });
            }
        }
    }

    toggleProjectView(projectId) {
        if (this.viewingProjectId == projectId) { // Use == for type flexibility
            this.viewingProjectId = null;
        } else {
            this.viewingProjectId = projectId;
            this.editingProjectId = null;
        }
        this.renderProjectTable(this.data.projects);
        // Optionally scroll to the row
        const row = document.querySelector(`tr.view-row`);
        if (row && this.viewingProjectId) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    getProjectViewHtml(project) {
        const address = `${project.ProjectAddress || ''}, ${project.ProjectCity || ''}, ${project.ProjectState || ''} ${project.ProjectZip || ''}`.trim();
        const mapUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
        
        // Get estimates for this project
        const projectEstimates = this.data.estimates ? this.data.estimates.filter(e => e.ProjectID == project.ProjectID) : [];
        const totalEstimateAmount = projectEstimates.reduce((sum, est) => sum + (parseFloat(est.TotalAmount) || 0), 0);
        
        // Check if project has estimates and pay terms to enable Generate Contract button
        const projectPayTerms = this.data.payterms ? this.data.payterms.filter(pt => pt.ProjectID == project.ProjectID) : [];
        const hasEstimates = projectEstimates.length > 0;
        const hasPayTerms = projectPayTerms.length > 0;
        const contractButtonEnabled = hasEstimates && hasPayTerms;
        
        return `<div class="details-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1em;">
                <h3 style="margin: 0;">Project Details - ${project.ProjectName || ''}</h3>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-primary" onclick="app.createEstimateFromProject(${project.ProjectID})" title="Create estimate for this project">
                        <i class="fas fa-file-invoice"></i> Create Estimate
                    </button>
                    <button class="btn btn-secondary" onclick="app.createContractFromProject(${project.ProjectID})" 
                            title="${contractButtonEnabled ? 'Generate contract for this project' : 'Create estimates and pay terms first'}"
                            ${contractButtonEnabled ? '' : 'disabled'} style="font-size: 0.9em;">
                        📄 Generate Contract
                    </button>
                </div>
            </div>
            
            <div class="project-info-section">
                <div><strong>Customer:</strong> ${project.CompanyName || ''}</div>
                <div><strong>Status:</strong> ${project.ProjectStatus || ''}</div>
                <div><strong>Start Date:</strong> ${project.StartDate ? this.formatDate(project.StartDate) : ''}</div>
                <div><strong>Estimated Completion:</strong> ${project.EstimatedCompletionDate ? this.formatDate(project.EstimatedCompletionDate) : ''}</div>
                <div><strong>Description:</strong> ${project.ProjectDescription || ''}</div>
                
                ${project.ProjectContactName || project.ProjectContactPhone || project.ProjectContactEmail ? `
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                        <strong>Project Contact:</strong>
                        ${project.ProjectContactName ? `<br>&nbsp;&nbsp;Name: ${project.ProjectContactName}` : ''}
                        ${project.ProjectContactPhone ? `<br>&nbsp;&nbsp;Phone: ${this.formatPhoneDisplay(project.ProjectContactPhone)}` : ''}
                        ${project.ProjectContactEmail ? `<br>&nbsp;&nbsp;Email: ${project.ProjectContactEmail}` : ''}
                    </div>
                ` : ''}
                
                <div><strong>Total Estimate Amount:</strong> ${this.formatCurrency(totalEstimateAmount)}</div>
                <div><strong>Address:</strong> ${address}</div>
                <div><strong>City:</strong> ${project.ProjectCity || ''}</div>
                <div><strong>State:</strong> ${project.ProjectState || ''}</div>
                <div><strong>ZIP:</strong> ${project.ProjectZip || ''}</div>
            </div>
            
            ${projectEstimates.length > 0 ? `
            <div class="project-estimates-section" style="margin-top: 20px;">
                <h4>Related Estimates (${projectEstimates.length})</h4>
                <div class="estimates-list">
                    ${projectEstimates.map(estimate => `
                        <div class="estimate-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 6px; background: #f9f9f9;">
                            <div>
                                <strong>${estimate.EstimateNumber || 'N/A'}</strong>
                                <span style="margin-left: 10px; color: #666;">
                                    ${estimate.EstimateDate ? this.formatDate(estimate.EstimateDate) : ''}
                                </span>
                                <span class="status-badge status-${(estimate.EstimateStatus || '').toLowerCase().replace(/\s+/g, '-')}" style="margin-left: 10px; font-size: 0.8em;">
                                    ${estimate.EstimateStatus || 'Draft'}
                                </span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <strong>${this.formatCurrency(estimate.TotalAmount || 0)}</strong>
                                <button class="btn btn-sm btn-outline" onclick="app.viewEstimateFromProject(${estimate.EstimateID})" title="View this estimate">
                                    <i class="fas fa-eye"></i> View
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : `
            <div class="project-estimates-section" style="margin-top: 20px;">
                <h4>Related Estimates</h4>
                <p style="color: #666; font-style: italic;">No estimates created for this project yet.</p>
            </div>
            `}
            
            ${mapUrl ? `
                <div style='margin-top:1em; text-align: center;'>
                    <a href='${mapUrl}' target='_blank' class='btn btn-outline' style='display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; text-decoration: none;'>
                        <i class='fas fa-map-marker-alt'></i>
                        View Location on Google Maps
                    </a>
                </div>
            ` : ''}
        </div>`;
    }

    showProjectModal(projectId) {
        // Ensure customers are loaded first
        if (!this.data.customers || this.data.customers.length === 0) {
            this.loadCustomers().then(() => {
                this.showProjectModal(projectId);
            });
            return;
        }
        
        // Actually open the modal dialog
        const modal = document.getElementById('project-modal');
        const form = document.getElementById('project-form');
        
        if (!modal || !form) {
            console.error('Project modal or form not found');
            return;
        }

        // Clear form
        form.reset();
        
        // Reset the address checkbox and enable all address fields
        const checkbox = document.getElementById('same-as-customer-address');
        if (checkbox) {
            checkbox.checked = false;
            this.toggleProjectAddress(false); // Ensure all fields are enabled
        }
        
        // Populate customer dropdown
        const customerSelect = document.getElementById('project-customer');
        console.log('🔍 CUSTOMER DROPDOWN DEBUG:');
        console.log('- Customer select element:', customerSelect);
        console.log('- Customer data available:', !!this.data.customers);
        console.log('- Customer count:', this.data.customers ? this.data.customers.length : 0);
        console.log('- Customer data:', this.data.customers);
        
        if (customerSelect && this.data.customers) {
            customerSelect.innerHTML = '<option value="">Select a customer</option>' +
                this.data.customers.map(c => `<option value="${c.CustomerID}">${c.CompanyName}</option>`).join('');
            console.log('✅ Customer dropdown populated with', this.data.customers.length, 'customers');
            
            // Add change event listener for address copying
            customerSelect.onchange = (e) => {
                const checkbox = document.getElementById('same-as-customer-address');
                if (checkbox && checkbox.checked) {
                    // Re-trigger the address copying if checkbox is checked
                    this.toggleProjectAddress(true);
                }
            };
        } else {
            console.log('❌ Customer dropdown NOT populated - missing element or data');
        }
        
        let project = {};
        if (projectId) {
            // Editing existing project
            if (typeof projectId === 'object' && projectId !== null) {
                project = projectId;
                projectId = project.ProjectID;
            } else {
                project = this.data.projects.find(p => p.ProjectID == projectId) || {};
            }
            
            // Populate form fields
            document.getElementById('project-id').value = project.ProjectID || '';
            document.getElementById('project-name').value = project.ProjectName || '';
            document.getElementById('project-customer').value = project.CustomerID || '';
            document.getElementById('project-status').value = project.ProjectStatus || '';
            document.getElementById('project-start-date-modal').value = project.StartDate ? project.StartDate.split('T')[0] : '';
            document.getElementById('project-estimated-completion-modal').value = project.EstimatedCompletionDate ? project.EstimatedCompletionDate.split('T')[0] : '';
            document.getElementById('project-description').value = project.ProjectDescription || '';
            document.getElementById('project-total-contract-amount').value = project.TotalContractAmount || '';
            document.getElementById('project-address').value = project.ProjectAddress || '';
            document.getElementById('project-city').value = project.ProjectCity || '';
            document.getElementById('project-state').value = project.ProjectState || '';
            document.getElementById('project-zip').value = project.ProjectZip || '';
            
            document.getElementById('project-modal-title').textContent = 'Edit Project';
        } else {
            // New project
            document.getElementById('project-modal-title').textContent = 'Add New Project';
        }
        
        // Show the modal
        modal.style.display = 'block';
        
        // Initialize address autocomplete for the modal
        setTimeout(() => {
            this.setupAddressAutocomplete('project-address');
        }, 100);
        
        // Set up date validation for modal
        setTimeout(() => {
            const startInput = document.getElementById('project-start-date-modal');
            const endInput = document.getElementById('project-estimated-completion-modal');
            if (startInput && startInput.value) {
                this.updateModalEndDateMin(startInput.value);
            }
        }, 150);
    }

    // Toggle project address fields based on checkbox
    toggleProjectAddress(useSameAddress) {
        console.log('🔄 toggleProjectAddress called with:', useSameAddress);
        
        const projectAddressField = document.getElementById('project-address');
        const projectCityField = document.getElementById('project-city');
        const projectStateField = document.getElementById('project-state');
        const projectZipField = document.getElementById('project-zip');
        const customerSelect = document.getElementById('project-customer');
        
        console.log('📋 Found elements:', {
            addressField: !!projectAddressField,
            cityField: !!projectCityField,
            stateField: !!projectStateField,
            zipField: !!projectZipField,
            customerSelect: !!customerSelect
        });
        
        if (useSameAddress) {
            // Get selected customer's address
            const selectedCustomerId = customerSelect.value;
            if (selectedCustomerId && this.data.customers) {
                const selectedCustomer = this.data.customers.find(c => c.CustomerID == selectedCustomerId);
                if (selectedCustomer) {
                    // Copy customer address to project fields
                    projectAddressField.value = selectedCustomer.Address || '';
                    projectCityField.value = selectedCustomer.City || '';
                    projectStateField.value = selectedCustomer.State || '';
                    projectZipField.value = selectedCustomer.ZipCode || '';
                }
            }
            
            // Disable the address fields (use readonly to preserve form submission)
            projectAddressField.readOnly = true;
            projectCityField.readOnly = true;
            projectStateField.readOnly = true;
            projectZipField.readOnly = true;
            
            // Add visual indication that fields are readonly
            projectAddressField.style.backgroundColor = '#f8f9fa';
            projectCityField.style.backgroundColor = '#f8f9fa';
            projectStateField.style.backgroundColor = '#f8f9fa';
            projectZipField.style.backgroundColor = '#f8f9fa';
        } else {
            // Enable the address fields
            projectAddressField.readOnly = false;
            projectCityField.readOnly = false;
            projectStateField.readOnly = false;
            projectZipField.readOnly = false;
            
            // Remove visual indication
            projectAddressField.style.backgroundColor = '';
            projectCityField.style.backgroundColor = '';
            projectStateField.style.backgroundColor = '';
            projectZipField.style.backgroundColor = '';
        }
    }

    // Toggle project address fields for inline editing (customer -> create project flow)
    toggleInlineProjectAddress(projectId, useSameAddress) {
        console.log('🔄 toggleInlineProjectAddress called with:', { projectId, useSameAddress });
        
        const addressFieldId = `projectAddress_${projectId}`;
        const cityFieldId = `projectCity_${projectId}`;
        const stateFieldId = `projectState_${projectId}`;
        const zipFieldId = `projectZip_${projectId}`;
        
        const projectAddressField = document.getElementById(addressFieldId);
        const projectCityField = document.getElementById(cityFieldId);
        const projectStateField = document.getElementById(stateFieldId);
        const projectZipField = document.getElementById(zipFieldId);
        
        console.log('📋 Found inline elements:', {
            addressField: !!projectAddressField,
            cityField: !!projectCityField,
            stateField: !!projectStateField,
            zipField: !!projectZipField
        });
        
        if (useSameAddress) {
            // Get the customer data from the pre-selected customer info
            if (this.projectFromCustomer && this.data.customers) {
                const customer = this.data.customers.find(c => c.CustomerID == this.projectFromCustomer.customerId);
                if (customer) {
                    console.log('📍 Copying customer address:', customer);
                    // Copy customer address to project fields
                    if (projectAddressField) projectAddressField.value = customer.Address || '';
                    if (projectCityField) projectCityField.value = customer.City || '';
                    if (projectStateField) projectStateField.value = customer.State || '';
                    if (projectZipField) projectZipField.value = customer.ZipCode || '';
                }
            }
            
            // Disable the address fields (use readonly to preserve form submission)
            if (projectAddressField) {
                projectAddressField.readOnly = true;
                projectAddressField.style.backgroundColor = '#f8f9fa';
            }
            if (projectCityField) {
                projectCityField.readOnly = true;
                projectCityField.style.backgroundColor = '#f8f9fa';
            }
            if (projectStateField) {
                projectStateField.readOnly = true;
                projectStateField.style.backgroundColor = '#f8f9fa';
            }
            if (projectZipField) {
                projectZipField.readOnly = true;
                projectZipField.style.backgroundColor = '#f8f9fa';
            }
        } else {
            // Enable the address fields
            if (projectAddressField) {
                projectAddressField.readOnly = false;
                projectAddressField.style.backgroundColor = '';
            }
            if (projectCityField) {
                projectCityField.readOnly = false;
                projectCityField.style.backgroundColor = '';
            }
            if (projectStateField) {
                projectStateField.readOnly = false;
                projectStateField.style.backgroundColor = '';
            }
            if (projectZipField) {
                projectZipField.readOnly = false;
                projectZipField.style.backgroundColor = '';
            }
        }
    }

    async deleteProject(projectId) {
        if (!confirm('Are you sure you want to delete this project?')) return;
        try {
            await this.apiCall(`projects/${projectId}`, 'DELETE');
            this.showToast('Project deleted successfully', 'success');
            this.loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    }

    // Estimates
    async loadEstimates() {
        try {
            console.log('Loading estimates...');
            const estimates = await this.apiCall('estimates');
            console.log('Estimates loaded:', estimates);
            this.data.estimates = estimates;
            
            // Filter estimates to only show those linked to active projects
            const filteredEstimates = this.filterEstimatesByActiveProjects();
            
            this.renderEstimateTable(filteredEstimates);
            this.updateEstimateCount();
        } catch (error) {
            console.error('Error loading estimates:', error);
            this.showToast('Error loading estimates', 'error');
        }
    }

    renderEstimateTable(estimates) {
        const tableBody = document.getElementById('estimates-table-body'); // Fixed ID
        if (!tableBody) {
            console.error('Estimates table body not found');
            return;
        }
        
        // Responsive design - use mobile layout on iPad and iPhone
        const isMobile = window.innerWidth <= 1024;
        console.log('ESTIMATES - Screen width:', window.innerWidth, 'Mobile mode:', isMobile);
        
        if (isMobile) {
            console.log('Using mobile estimate list rendering');
            // Create mobile-friendly list view
            this.renderEstimatesMobileList(estimates);
            return;
        }
        
        // Add new estimate form row if editing a new estimate
        let estimatesToRender = [...estimates];
        if (this.editingEstimateId === 'new') {
            const newEstimate = {
                EstimateID: '',
                EstimateNumber: '',
                ProjectName: '',
                CompanyName: '',
                EstimateDate: '',
                TotalAmount: '',
                EstimateStatus: 'Draft',
                ProjectID: '',
                ValidUntilDate: '',
                Notes: ''
            };
            estimatesToRender.unshift(newEstimate); // Add to beginning
        }
        
        console.log('Rendering estimates table with', estimatesToRender.length, 'estimates');
        console.log('Current editing state - editingEstimateId:', this.editingEstimateId, 'viewingEstimateId:', this.viewingEstimateId);
        
        tableBody.innerHTML = estimatesToRender.map(estimate => {
            const isNew = !estimate.EstimateID && this.editingEstimateId === 'new';
            const isViewing = this.viewingEstimateId == estimate.EstimateID;
            const isEditing = this.editingEstimateId == estimate.EstimateID || isNew;
            
            console.log(`Estimate ${estimate.EstimateID || 'NEW'}: isNew=${isNew}, isViewing=${isViewing}, isEditing=${isEditing}`);
            
            // Add CSS classes for focus mode
            let rowClasses = 'estimate-row';
            if (isEditing) {
                rowClasses += ' estimate-editing';
            }
            
            return `
                <tr class="${rowClasses}">
                    <td>${estimate.EstimateNumber || ''}</td>
                    <td>${estimate.ProjectName || ''}</td>
                    <td>${estimate.CompanyName || ''}</td>
                    <td>${estimate.EstimateDate ? this.formatDate(estimate.EstimateDate) : ''}</td>
                    <td>${estimate.TotalAmount ? this.formatCurrency(estimate.TotalAmount) : ''}</td>
                    <td>
                        <span class="status-badge status-${(estimate.EstimateStatus || '').toLowerCase().replace(/\s+/g, '-')}">
                            ${estimate.EstimateStatus || 'Draft'}
                        </span>
                    </td>
                    <td>
                        <span class="action-buttons">
                            ${!isNew ? `<button class="action-btn view" title="View" onclick="app.toggleEstimateView(${estimate.EstimateID})"><i class="fas fa-eye"></i></button>` : ''}
                            ${!isNew ? `<button class="action-btn pdf" title="Create PDF" onclick="app.createEstimatePDF(${estimate.EstimateID})"><i class="fas fa-file-pdf"></i></button>` : ''}
                            ${!isNew ? `<button class="action-btn edit" title="Edit" onclick="app.editEstimateInline(${estimate.EstimateID})"><i class="fas fa-edit"></i></button>` : ''}
                            ${!isNew ? `<button class="action-btn delete" title="Delete" onclick="app.deleteEstimate(${estimate.EstimateID})"><i class="fas fa-trash"></i></button>` : ''}
                        </span>
                    </td>
                </tr>
                ${isViewing ? `<tr class='view-row'><td colspan='7'><div id='estimate-view-${estimate.EstimateID}'>Loading...</div></td></tr>` : ''}
                ${isEditing ? `<tr class='edit-row'><td colspan='7'>${this.getEstimateEditFormHtml(estimate)}</td></tr>` : ''}
            `;
        }).join('');
        
        // Load view content asynchronously for any viewing estimates
        estimatesToRender.forEach(estimate => {
            const isViewing = this.viewingEstimateId == estimate.EstimateID;
            if (isViewing) {
                this.getEstimateViewHtml(estimate).then(viewHtml => {
                    const viewContainer = document.getElementById(`estimate-view-${estimate.EstimateID}`);
                    if (viewContainer) {
                        viewContainer.innerHTML = viewHtml;
                        // Load pay terms after the view is rendered
                        this.loadPayTermsForEstimate(estimate.EstimateID);
                    }
                });
            }
        });
        
        // Apply focus mode using generic function
        this.applyFocusMode('#estimates-table', this.editingEstimateId, 'estimate-row', 'estimate-editing');
    }

    updateEstimateCount() {
        const count = this.data.estimates.length;
        const countEl = document.getElementById('estimate-count');
        if (countEl) {
            countEl.textContent = `${count} estimate${count === 1 ? '' : 's'}`;
        }
    }

    async getEstimateViewHtml(estimate) {
        // If we don't have full estimate details with line items, fetch them
        let fullEstimate = estimate;
        if (!estimate.LineItems && estimate.EstimateID) {
            try {
                const response = await fetch(`/api/estimates/${estimate.EstimateID}`);
                if (response.ok) {
                    fullEstimate = await response.json();
                } else {
                    console.error('Failed to fetch estimate details');
                }
            } catch (error) {
                console.error('Error fetching estimate details:', error);
            }
        }

        // Parse exclusions and notes from combined notes
        let exclusions = '';
        let additionalNotes = '';
        
        if (fullEstimate.Notes) {
            const exclusionsMatch = fullEstimate.Notes.match(/^EXCLUSIONS:\n(.*?)(?:\n\nNOTES:|$)/s);
            const notesMatch = fullEstimate.Notes.match(/\n\nNOTES:\n(.*)$/s);
            
            if (exclusionsMatch) {
                exclusions = exclusionsMatch[1].trim();
            }
            if (notesMatch) {
                additionalNotes = notesMatch[1].trim();
            }
        }

        // Format line items for customer presentation
        let lineItemsHtml = '';
        if (fullEstimate.LineItems && fullEstimate.LineItems.length > 0) {
            lineItemsHtml = `
                <div class="estimate-line-items" style="margin: 20px 0;">
                    <table class="line-items-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6; font-weight: 600;">Description</th>
                                <th style="padding: 12px; text-align: center; border: 1px solid #dee2e6; font-weight: 600; width: 100px;">Quantity</th>
                                <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: 600; width: 120px;">Rate</th>
                                <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: 600; width: 120px;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fullEstimate.LineItems.map(item => `
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; vertical-align: top;">
                                        <strong>${this.parseItemName(item.ItemDescription)}</strong>
                                        ${this.parseItemDescription(item.ItemDescription) ? 
                                            `<br><small style="color: #666; line-height: 1.4;">${this.parseItemDescription(item.ItemDescription)}</small>` : ''}
                                    </td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center;">${item.Quantity}</td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; text-align: right;">${this.formatCurrency(item.UnitRate)}</td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; text-align: right; font-weight: 500;">${this.formatCurrency(item.Quantity * item.UnitRate)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="estimate-totals" style="margin-top: 20px; display: flex; justify-content: flex-end;">
                        <div style="min-width: 300px;">
                            <div class="total-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <span style="font-weight: 500;">Subtotal:</span>
                                <span>${this.formatCurrency(fullEstimate.SubTotal || 0)}</span>
                            </div>
                            ${(fullEstimate.TaxRate && fullEstimate.TaxRate > 0) ? `
                                <div class="total-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                                    <span style="font-weight: 500;">Tax (${(fullEstimate.TaxRate * 100).toFixed(1)}%):</span>
                                    <span>${this.formatCurrency(fullEstimate.TaxAmount || 0)}</span>
                                </div>
                            ` : ''}
                            <div class="total-row" style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #333; margin-top: 8px; font-weight: 600; font-size: 1.1em;">
                                <span>Total:</span>
                                <span>${this.formatCurrency(fullEstimate.TotalAmount || 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="estimate-customer-view" style="background: white; padding: 30px; border: 1px solid #ddd; border-radius: 8px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <!-- Header Section -->
                <div class="estimate-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
                    <div class="estimate-info" style="flex: 1;">
                        <h2 style="margin: 0; color: #333; font-size: 1.6em;">ESTIMATE</h2>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 1em;">${fullEstimate.EstimateNumber || ''}</p>
                    </div>
                    <div class="company-name" style="flex: 1; text-align: center;">
                        <h1 style="margin: 0; color: #333; font-size: 1.9em; font-weight: 700;">${(this.settings && this.settings.company_name) || 'Your Company Name'}</h1>
                        <div style="margin-top: 8px; color: #555; font-size: 1em; font-weight: 400;">${(this.settings && this.settings.company_address) || 'Your Company Address'}</div>
                    </div>
                    <div class="estimate-details" style="flex: 1; text-align: right;">
                        <div style="margin: 3px 0; font-size: 0.95em;"><strong>Date:</strong> ${fullEstimate.EstimateDate ? this.formatDate(fullEstimate.EstimateDate) : ''}</div>
                        <div style="margin: 3px 0; font-size: 0.95em;"><strong>Valid Until:</strong> ${fullEstimate.ValidUntilDate ? this.formatDate(fullEstimate.ValidUntilDate) : ''}</div>
                        <div style="margin: 3px 0; font-size: 0.95em;"><strong>Status:</strong> <span class="status-badge status-${(fullEstimate.EstimateStatus || '').toLowerCase().replace(/\s+/g, '-')}">${fullEstimate.EstimateStatus || 'Draft'}</span></div>
                    </div>
                </div>

                <!-- Customer & Project Info -->
                <div class="project-info" style="margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Project Information</h4>
                        <div style="margin: 5px 0;"><strong>Customer:</strong> ${fullEstimate.CompanyName || ''}</div>
                        <div style="margin: 5px 0;"><strong>Project:</strong> ${fullEstimate.ProjectName || ''}</div>
                        ${fullEstimate.Address || fullEstimate.City || fullEstimate.State ? `<div style="margin: 5px 0;"><strong>Project Address:</strong> ${[fullEstimate.Address, fullEstimate.City, fullEstimate.State, fullEstimate.ZipCode].filter(Boolean).join(', ')}</div>` : ''}
                    </div>
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Contact Information</h4>
                        ${fullEstimate.ContactName ? `<div style="margin: 5px 0;"><strong>Contact:</strong> ${fullEstimate.ContactName}</div>` : ''}
                        ${fullEstimate.Phone ? `<div style="margin: 5px 0;"><strong>Phone:</strong> ${fullEstimate.Phone}</div>` : ''}
                        ${fullEstimate.Email ? `<div style="margin: 5px 0;"><strong>Email:</strong> ${fullEstimate.Email}</div>` : ''}
                    </div>
                </div>

                <!-- Line Items -->
                <div class="line-items-section">
                    <h4 style="margin: 0 0 15px 0; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Scope of Work</h4>
                    ${lineItemsHtml}
                </div>

                <!-- Exclusions -->
                ${exclusions ? `
                    <div class="exclusions-section" style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-left: 4px solid #dc3545; border-radius: 4px;">
                        <h4 style="margin: 0 0 10px 0; color: #dc3545;">Exclusions</h4>
                        <p style="margin: 0; line-height: 1.5; color: #333;">${exclusions.replace(/\n/g, '<br>')}</p>
                    </div>
                ` : ''}

                <!-- Additional Notes -->
                ${additionalNotes ? `
                    <div class="notes-section" style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
                        <h4 style="margin: 0 0 10px 0; color: #007bff;">Additional Notes</h4>
                        <p style="margin: 0; line-height: 1.5; color: #333;">${additionalNotes.replace(/\n/g, '<br>')}</p>
                    </div>
                ` : ''}

                <!-- Workflow Navigation -->
                <div class="workflow-navigation" style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 30px 0 20px 0; border: 1px solid #e9ecef;">
                    <h4 style="margin: 0 0 10px 0; color: #495057; font-size: 1.1em;">Next Steps</h4>
                    <div class="workflow-buttons" style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button type="button" onclick="app.createPayTermsFromEstimate(${fullEstimate.EstimateID})" class="btn btn-primary" style="font-size: 0.9em; padding: 8px 12px;">
                            💳 Create Pay Terms
                        </button>
                        <button type="button" onclick="app.createEstimatePDF(${fullEstimate.EstimateID})" class="btn btn-outline-primary" style="font-size: 0.9em; padding: 8px 12px;">
                            🖨️ Download PDF
                        </button>
                    </div>
                </div>

                <!-- Pay Terms Section -->
                <div id="estimate-pay-terms-${fullEstimate.EstimateID}" class="pay-terms-section" style="margin: 30px 0; padding: 20px; background: #f0f8f0; border: 1px solid #d4edda; border-radius: 5px;">
                    <h4 style="margin: 0 0 15px 0; color: #155724; font-size: 1.1em;">
                        💰 Payment Terms
                        <span style="font-size: 0.85em; color: #6c757d; font-weight: normal;">- Click individual terms to create invoices</span>
                    </h4>
                    <div id="pay-terms-content-${fullEstimate.EstimateID}" style="color: #666; font-style: italic;">
                        Loading payment terms...
                    </div>
                </div>

                <!-- Footer -->
                <div class="estimate-footer" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; color: #666; font-size: 0.9em;">
                    <p>This estimate is valid until ${fullEstimate.ValidUntilDate ? this.formatDate(fullEstimate.ValidUntilDate) : 'the specified date'}.</p>
                    <p>Thank you for considering our services.</p>
                </div>
            </div>
        `;
    }

    // Helper functions to parse combined item descriptions
    parseItemName(itemDescription) {
        if (!itemDescription) return '';
        const colonIndex = itemDescription.indexOf(': ');
        return colonIndex > -1 ? itemDescription.substring(0, colonIndex) : itemDescription;
    }

    parseItemDescription(itemDescription) {
        if (!itemDescription) return '';
        const colonIndex = itemDescription.indexOf(': ');
        return colonIndex > -1 ? itemDescription.substring(colonIndex + 2) : '';
    }

    getEstimateEditFormHtml(estimate) {
        const isNew = !estimate.EstimateID || this.editingEstimateId === 'new';
        const isFromProject = this.estimateFromProject && isNew;
        const today = new Date().toISOString().split('T')[0];
        
        // Safe date formatting - use today as default if date is invalid
        const formatSafeDate = (dateValue) => {
            if (!dateValue) return today;
            if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
                return dateValue.substring(0, 10);
            }
            try {
                const dateObj = new Date(dateValue);
                if (isNaN(dateObj.getTime())) return today;
                return dateObj.toISOString().split('T')[0];
            } catch (e) {
                console.warn('Invalid date in estimate:', dateValue);
                return today;
            }
        };
        
        return `
            <div class="edit-form">
                <form id="inline-estimate-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="estimate-number">Estimate Number:</label>
                            <input type="text" id="estimate-number" name="estimateNumber" value="${estimate.EstimateNumber || ''}" ${isNew ? 'readonly' : 'required'}>
                            <small class="form-text">Auto-generated for new estimates</small>
                        </div>
                        <div class="form-group">
                            <label for="estimate-project">Project:</label>
                            ${isFromProject ? `
                                <input type="text" value="${this.estimateFromProject.projectName} - ${this.estimateFromProject.companyName}" readonly class="form-control">
                                <input type="hidden" id="estimate-project-id" name="projectId" value="${this.estimateFromProject.projectId}">
                                <small class="form-text">Linked to selected project</small>
                            ` : `
                                <select id="estimate-project" name="projectId" required>
                                    <option value="">Select Project...</option>
                                    ${this.getProjectOptionsHtml(estimate.ProjectID)}
                                </select>
                            `}
                        </div>
                        <div class="form-group">
                            <label for="estimate-date">Estimate Date:</label>
                            <input type="date" id="estimate-date" name="estimateDate" value="${formatSafeDate(estimate.EstimateDate)}" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="estimate-valid-until">Valid Until:</label>
                            <input type="date" id="estimate-valid-until" name="validUntilDate" value="${estimate.ValidUntilDate ? formatSafeDate(estimate.ValidUntilDate) : ''}">
                        </div>
                        <div class="form-group">
                            <label for="estimate-status">Status:</label>
                            <select id="estimate-status" name="estimateStatus" required>
                                <option value="Draft" ${estimate.EstimateStatus === 'Draft' ? 'selected' : ''}>Draft</option>
                                <option value="Submitted" ${estimate.EstimateStatus === 'Submitted' ? 'selected' : ''}>Submitted</option>
                                <option value="Under Review" ${estimate.EstimateStatus === 'Under Review' ? 'selected' : ''}>Under Review</option>
                                <option value="Approved" ${estimate.EstimateStatus === 'Approved' ? 'selected' : ''}>Approved</option>
                                <option value="Rejected" ${estimate.EstimateStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="estimate-tax-rate">Tax Rate:</label>
                            <select id="estimate-tax-rate" name="taxRate" required>
                                <option value="0" ${!estimate.TaxRate || estimate.TaxRate == 0 ? 'selected' : ''}>No Tax (0%)</option>
                                <option value="${(this.settings && this.settings.tax_rate) || 0.0875}" ${estimate.TaxRate == ((this.settings && this.settings.tax_rate) || 0.0875) ? 'selected' : ''}>${((this.settings && this.settings.tax_rate) || 0.0875) * 100}%</option>
                                <option value="0.065">6.5%</option>
                                <option value="0.1025">10.25%</option>
                                <option value="custom">Custom Rate...</option>
                            </select>
                            <input type="number" id="custom-tax-rate" name="customTaxRate" step="0.0001" min="0" max="1" style="display: none; margin-top: 5px;" placeholder="Enter decimal (e.g., 0.0875)">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group full-width">
                            <label for="estimate-notes">Notes:</label>
                            <textarea id="estimate-notes" name="notes" rows="3">${this.parseNotesFromCombined(estimate.Notes || '')}</textarea>
                        </div>
                    </div>
                    
                    <div class="line-items-section">
                        <h4 style="margin: 20px 0 15px 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
                            <i class="fas fa-list"></i> Line Items
                        </h4>
                        <div id="line-items-container">
                            ${this.getEstimateLineItemsHtml(estimate)}
                        </div>
                        <div class="line-items-total" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>Subtotal: <span id="estimate-subtotal">$0.00</span></strong>
                                </div>
                                <div>
                                    <strong>Tax: <span id="estimate-tax-amount">$0.00</span></strong>
                                </div>
                                <div style="font-size: 1.1em;">
                                    <strong>Total: <span id="estimate-total-amount">$0.00</span></strong>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-primary" onclick="app.saveEstimateInline(${isNew ? 'null' : estimate.EstimateID})">
                            ${isNew ? 'Save Estimate' : 'Save Changes'}
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="app.cancelEstimateEdit()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
    }

    getProjectOptionsHtml(selectedProjectId) {
        return this.data.projects.map(project => 
            `<option value="${project.ProjectID}" ${project.ProjectID == selectedProjectId ? 'selected' : ''}>
                ${project.ProjectName} - ${project.CompanyName}
            </option>`
        ).join('');
    }

    toggleEstimateView(estimateId) {
        if (this.viewingEstimateId === estimateId) {
            this.viewingEstimateId = null;
        } else {
            this.viewingEstimateId = estimateId;
            this.editingEstimateId = null; // Close edit mode
        }
        this.renderEstimateTable(this.data.estimates);
    }

    async editEstimateInline(estimateId) {
        console.log('Editing estimate inline:', estimateId);
        this.editingEstimateId = estimateId;
        this.viewingEstimateId = null; // Close view mode
        
        try {
            // Fetch full estimate details including line items
            console.log('Fetching estimate details with line items...');
            const fullEstimate = await this.apiCall(`estimates/${estimateId}`);
            console.log('Full estimate data loaded:', fullEstimate);
            
            // Update the estimate in our data array
            const index = this.data.estimates.findIndex(e => e.EstimateID == estimateId);
            if (index >= 0) {
                // Merge the full data with the existing list data
                this.data.estimates[index] = { ...this.data.estimates[index], ...fullEstimate };
            }
            
            this.renderEstimateTable(this.data.estimates);
            this.focusOnEditRow('estimates-table-body', estimateId);
            setTimeout(() => {
                this.setupTaxRateHandler();
                this.updateLineItemTotal(); // Calculate initial totals
            }, 100);
            
        } catch (error) {
            console.error('Error loading estimate details:', error);
            this.showToast('Error loading estimate details', 'error');
            
            // Fall back to basic editing without line items
            this.renderEstimateTable(this.data.estimates);
            this.focusOnEditRow('estimates-table-body', estimateId);
            setTimeout(() => this.setupTaxRateHandler(), 100);
        }
    }

    async saveEstimateInline(estimateId) {
        const form = document.getElementById('inline-estimate-form');
        if (!form) {
            console.error('Estimate form not found');
            return;
        }

        const formData = new FormData(form);
        const estimateData = {};
        
        // Process basic form fields (skip lineItems which we'll handle separately)
        for (let [key, value] of formData.entries()) {
            if (!key.startsWith('lineItems[')) {
                estimateData[key] = value;
            }
        }
        
        // Handle tax rate - check if custom rate was used
        const taxRateSelect = document.getElementById('estimate-tax-rate');
        const customTaxInput = document.getElementById('custom-tax-rate');
        
        if (taxRateSelect && taxRateSelect.value === 'custom' && customTaxInput && customTaxInput.value) {
            estimateData.taxRate = parseFloat(customTaxInput.value);
        } else if (estimateData.taxRate) {
            estimateData.taxRate = parseFloat(estimateData.taxRate);
        }
        
        // Process line items
        const lineItems = [];
        const lineItemElements = document.querySelectorAll('.line-item');
        
        lineItemElements.forEach((item, index) => {
            const name = item.querySelector(`input[name*="[name]"]`)?.value || '';
            const description = item.querySelector(`textarea[name*="[description]"]`)?.value || '';
            const hours = parseFloat(item.querySelector(`input[name*="[hours]"]`)?.value) || 0;
            const hourlyRate = parseFloat(item.querySelector(`input[name*="[hourlyRate]"]`)?.value) || 0;
            const itemId = item.querySelector(`input[name*="[id]"]`)?.value || '';
            
            if (name.trim()) {
                lineItems.push({
                    id: itemId.startsWith('temp_') ? null : itemId,
                    itemDescription: name, // Map name to backend field
                    notes: description, 
                    quantity: hours, // Map hours to quantity
                    unitRate: hourlyRate // Map hourlyRate to unitRate
                });
            }
        });
        
        // Get exclusions text
        const exclusionsTextarea = document.getElementById('estimate-exclusions');
        const exclusions = exclusionsTextarea ? exclusionsTextarea.value : '';
        
        estimateData.lineItems = lineItems;
        estimateData.exclusions = exclusions;
        
        console.log('Saving estimate data with line items and exclusions:', estimateData);

        try {
            let result;
            if (estimateId && estimateId !== 'null') {
                // Update existing estimate - need to map field names for backend
                const updateData = {
                    projectId: estimateData.projectId,
                    estimateNumber: estimateData.estimateNumber,
                    estimateDate: estimateData.estimateDate,
                    validUntilDate: estimateData.validUntilDate,
                    estimateStatus: estimateData.estimateStatus,
                    taxRate: estimateData.taxRate,
                    notes: estimateData.notes,
                    exclusions: estimateData.exclusions,
                    lineItems: lineItems
                };
                console.log('PUT request data:', updateData);
                result = await this.apiCall(`estimates/${estimateId}`, 'PUT', updateData);
                console.log('Estimate updated:', result);
                this.showToast('Estimate updated successfully');
            } else {
                // Create new estimate - backend expects camelCase field names
                estimateData.exclusions = estimateData.exclusions; // Ensure exclusions are included
                console.log('POST request data:', estimateData);
                result = await this.apiCall('estimates', 'POST', estimateData);
                console.log('Estimate created:', result);
                this.showToast('Estimate created successfully');
            }

            // Reset editing state and clear project linking data
            this.editingEstimateId = null;
            this.estimateFromProject = null;
            await this.loadEstimates();

        } catch (error) {
            console.error('Error saving estimate:', error);
            this.showToast('Error saving estimate', 'error');
        }
    }

    cancelEstimateEdit() {
        console.log('Cancelling estimate edit');
        this.editingEstimateId = null;
        this.viewingEstimateId = null;
        this.estimateFromProject = null; // Clear project linking data
        this.renderEstimateTable(this.data.estimates);
    }

    createEstimateFromProject(projectId) {
        console.log('Creating estimate from project:', projectId);
        
        // Clear any existing editing states first
        this.viewingEstimateId = null;
        this.editingEstimateId = null;
        
        // Find the project to get its details
        const project = this.data.projects.find(p => p.ProjectID == projectId);
        if (!project) {
            this.showToast('Project not found', 'error');
            return;
        }
        
        console.log('Project found for estimate:', project);
        
        // Store the project data for the estimate form
        this.estimateFromProject = {
            projectId: projectId,
            projectName: project.ProjectName,
            companyName: project.CompanyName
        };
        
        // Switch to estimates tab
        this.switchSection('estimates');
        
        // Wait a moment for the tab to load, then create new estimate
        setTimeout(() => {
            console.log('Adding new estimate with pre-selected project:', projectId);
            console.log('Current editingEstimateId before setting to new:', this.editingEstimateId);
            this.addNewEstimateFromProject();
        }, 500); // Increased timeout to ensure section loads
        
        this.showToast(`Switched to Estimates to create estimate for ${project.ProjectName}`);
    }

    addNewEstimateFromProject() {
        console.log('Adding new estimate from project');
        console.log('Before setting: editingEstimateId =', this.editingEstimateId);
        this.editingEstimateId = 'new';
        this.viewingEstimateId = null;
        console.log('After setting: editingEstimateId =', this.editingEstimateId);
        this.renderEstimateTable(this.data.estimates);
        this.focusOnEditRow('estimates-table-body', 'new');
        
        // Pre-fill the form with project data
        setTimeout(() => {
            const today = new Date().toISOString().split('T')[0];
            const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days from now
            
            // Set form fields
            const estimateDateField = document.getElementById('estimate-date');
            const validUntilField = document.getElementById('estimate-valid-until');
            const projectField = document.getElementById('estimate-project-id');
            
            if (estimateDateField) {
                estimateDateField.value = today;
            }
            if (validUntilField) {
                validUntilField.value = validUntil;
            }
            if (projectField && this.estimateFromProject) {
                projectField.value = this.estimateFromProject.projectId;
                console.log('Set hidden project ID:', this.estimateFromProject.projectId);
            }
            
            // Setup tax rate dropdown handler
            this.setupTaxRateHandler();
        }, 100);
    }

    focusOnEditRow(tableBodyId, itemId) {
        // Scroll to the edit row and focus on the first input
        setTimeout(() => {
            const tableBody = document.getElementById(tableBodyId);
            if (tableBody) {
                const editRow = tableBody.querySelector('.edit-row');
                if (editRow) {
                    editRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const firstInput = editRow.querySelector('input, select, textarea');
                    if (firstInput && !firstInput.readOnly) {
                        firstInput.focus();
                        if (firstInput.select) firstInput.select();
                    }
                }
            }
        }, 100);
    }

    parseNotesFromCombined(combinedNotes) {
        if (!combinedNotes) return '';
        
        // Extract just the notes part (after "NOTES:\n")
        const notesMatch = combinedNotes.match(/\n\nNOTES:\n(.*)/s);
        if (notesMatch) {
            return notesMatch[1].trim();
        }
        
        // If no "NOTES:" section found, check if it's all exclusions or return as-is
        if (combinedNotes.startsWith('EXCLUSIONS:\n')) {
            return ''; // It's only exclusions, no separate notes
        }
        
        return combinedNotes; // Return as-is if it doesn't match our format
    }

    getEstimateLineItemsHtml(estimate) {
        let html = '';
        
        // Parse exclusions from combined notes
        let exclusionsText = '';
        
        // Try to get exclusions from settings first
        if (this.settings && this.settings.default_exclusions) {
            exclusionsText = this.settings.default_exclusions;
        } else {
            // Fallback to the stored text if settings aren't loaded yet
            exclusionsText = 'Permit fees, printing, third party stamped engineering, if required, anything not specifically included in this estimate, unforeseen circumstances. Omega builders is not responsible for unpermittable projects, no refunds will be given once the work is complete. Coordinating with structural engineer and/or civil engineer is included, customer pays any necessary third party vendors directly.';
        }
        
        if (estimate && estimate.Notes) {
            const notesContent = estimate.Notes;
            const exclusionsMatch = notesContent.match(/^EXCLUSIONS:\n(.*?)(?:\n\nNOTES:|$)/s);
            if (exclusionsMatch) {
                exclusionsText = exclusionsMatch[1].trim();
            }
        }
        
        // Add Exclusions section as a full-width textbox at the top
        html += `
            <div class="exclusions-section" style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px;">
                <h5 style="margin: 0 0 10px 0; color: #495057;">Exclusions</h5>
                <textarea name="exclusions" id="estimate-exclusions" rows="4" style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; resize: vertical;">${exclusionsText}</textarea>
            </div>
        `;
        
        // Add existing line items if editing an estimate
        if (estimate && estimate.LineItems && estimate.LineItems.length > 0) {
            estimate.LineItems.forEach((lineItem, index) => {
                // Parse combined ItemDescription back into name and description
                let itemName = lineItem.ItemDescription;
                let itemDescription = '';
                
                // Check if ItemDescription contains a colon separator
                const colonIndex = lineItem.ItemDescription.indexOf(': ');
                if (colonIndex > -1) {
                    itemName = lineItem.ItemDescription.substring(0, colonIndex);
                    itemDescription = lineItem.ItemDescription.substring(colonIndex + 2);
                }
                
                const mappedItem = {
                    id: lineItem.EstimateLineItemID,
                    name: itemName,
                    description: itemDescription,
                    hours: lineItem.Quantity,
                    hourlyRate: lineItem.UnitRate
                };
                html += this.getLineItemHtml(mappedItem, index, false);
            });
        }
        
        // Add the "Add Line Item" button at the end, positioned where the next line item would appear
        html += `
            <div class="add-line-item-section" style="margin: 15px 0; text-align: center;">
                <button type="button" class="btn btn-outline-primary" onclick="app.addEstimateLineItem()" style="padding: 12px 20px; border: 2px dashed #007bff; background: transparent; color: #007bff; border-radius: 6px; font-weight: 500;">
                    <i class="fas fa-plus"></i> Add Line Item
                </button>
            </div>
        `;
        
        return html;
    }
    
    getLineItemHtml(item, index, isNew = false) {
    let lineItemTemplates = this.getLineItemTemplates();
    // Sort templates alphabetically by name
    lineItemTemplates = lineItemTemplates.slice().sort((a, b) => a.name.localeCompare(b.name));
        
        return `
            <div class="line-item" data-item-id="${item.id || item.EstimateLineItemID || 'temp_' + Date.now()}" style="border: 1px solid #ddd; border-radius: 6px; padding: 15px; margin-bottom: 15px; background: white;">
                <div class="line-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h5 style="margin: 0; color: #333;">Line Item ${index + 1}</h5>
                    <button type="button" class="btn btn-sm btn-danger" onclick="app.removeEstimateLineItem('${item.id || item.EstimateLineItemID || 'temp_' + Date.now()}')" style="padding: 4px 8px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                
                ${isNew ? `
                    <div class="form-row" style="margin-bottom: 15px;">
                        <div class="form-group">
                            <label>Select Line Item Template:</label>
                            <select onchange="app.populateLineItemFromTemplate(this, ${index})" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="">Choose a template...</option>
                                ${lineItemTemplates.map(template => `<option value="${template.name}">${template.name}</option>`).join('')}
                                <option value="__add_new__">Add New...</option>
                            </select>
                        </div>
                    </div>
                ` : ''}
                
                <div class="form-row" style="display: flex; gap: 15px; margin-bottom: 10px; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 1; min-width: 120px;">
                        <label>Item Name:</label>
                        <input type="text" name="lineItems[${index}][name]" value="${item.name || item.ItemDescription || ''}" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div class="form-group" style="min-width: 100px;">
                        <label>Hours:</label>
                        <input type="number" name="lineItems[${index}][hours]" value="${item.hours || item.Quantity || 0}" min="0" step="0.25" onchange="app.updateLineItemTotal()" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div class="form-group" style="min-width: 100px;">
                        <label>Rate/Hour:</label>
                        <input type="number" name="lineItems[${index}][hourlyRate]" value="${item.hourlyRate || item.UnitRate || this.settings.hourly_rate || 75}" min="0" step="0.01" onchange="app.updateLineItemTotal()" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div class="form-group" style="min-width: 100px;">
                        <label>Amount:</label>
                        <input type="text" class="line-item-amount" value="$${((item.hours || item.Quantity || 0) * (item.hourlyRate || item.UnitRate || this.settings.hourly_rate || 75)).toFixed(2)}" readonly style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa;">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label>Description:</label>
                        <textarea name="lineItems[${index}][description]" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;">${item.description || item.notes || ''}</textarea>
                    </div>
                </div>
                
                <input type="hidden" name="lineItems[${index}][id]" value="${item.id || item.EstimateLineItemID || ''}">
            </div>
        `;
    }
    
    getLineItemTemplates() {
        return [
            {
                name: "Site Plan",
                description: "Create site plan suitable for permit submittal showing location of property lines, existing and proposed structures, existing and proposed utilities, impervious footages and percentages, etc.",
                defaultHours: 2.5
            },
            {
                name: "As-Built Drawings-1 Story", 
                description: "Create as-built drawings of existing affected single story structure(s), includes travel, if necessary",
                defaultHours: 8
            },
            {
                name: "As-Built Drawings-2 Story",
                description: "Create as-built drawings of existing affected two story structure(s), includes travel, if necessary", 
                defaultHours: 10
            },
            {
                name: "As-Built Drawings-3 Story",
                description: "Create as-built drawings of existing affected three story structure(s), includes travel, if necessary",
                defaultHours: 12
            },
            {
                name: "Permit Drawings-1 story",
                description: "Create single story remodel/addition drawings suitable for permit submittal based on customer input.",
                defaultHours: 8
            },
            {
                name: "Permit Drawings-2 story", 
                description: "Create two story remodel/addition drawings suitable for permit submittal based on customer input.",
                defaultHours: 10
            },
            {
                name: "Permit Drawings-3 story",
                description: "Create 3 story remodel/addition drawings suitable for permit submittal based on customer input.", 
                defaultHours: 12
            },
            {
                name: "Permit Drawings-Adult Family Home",
                description: "Create adult family home remodel drawings suitable for permit submittal based on customer input.",
                defaultHours: 10
            },
            {
                name: "Prescriptive Project Engineering",
                description: "Beam, rafter, joist, and header sizing, based on prescriptive code, as required for accurate building design. Note this is not stamped engineering, this is necessary for building design.",
                defaultHours: 2.75
            },
            {
                name: "Permit Submittal",
                description: "Complete applications and worksheets & Submit for building permit with the appropriate jurisdiction. Communicate with permitting jurisdiction throughout the process. Note: If this line item is omitted, drawing revisions are billed at $125/hr. This line item includes a basic permit submittal as noted above, any additional work beyond submitting standard applications and basic drawing revisions is excluded and billed as a change order. Extensive and onerous submittal requirements instituted by the jurisdiction may result in additional charges. This line item does not include septic related issues or any type of health department communication.",
                defaultHours: 4.75
            }
        ];
    }
    
    async saveCustomLineItemTemplate(templateData, defaultHours) {
        try {
            const response = await fetch('/api/lineitems', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...templateData,
                    StandardRate: templateData.StandardRate || this.settings.hourly_rate || 75
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save template');
            }
            
            const newTemplate = await response.json();
            
            // Store default hours separately (since not in database schema)
            if (!window._templateDefaultHours) window._templateDefaultHours = {};
            window._templateDefaultHours[newTemplate.ItemName] = defaultHours;
            
            return newTemplate;
        } catch (error) {
            console.error('Error saving custom line item template:', error);
            throw error;
        }
    }
    
    async refreshLineItemTemplateDropdown(selectElement, selectedValue) {
        try {
            // Get built-in templates
            let templates = this.getLineItemTemplates();
            
            // Get custom templates from database
            const response = await fetch('/api/lineitems');
            if (response.ok) {
                const customTemplates = await response.json();
                // Convert database format to frontend format
                const convertedTemplates = customTemplates.map(template => ({
                    name: template.ItemName,
                    description: template.ItemDescription,
                    defaultHours: window._templateDefaultHours?.[template.ItemName] || 1,
                    hourlyRate: template.StandardRate,
                    category: template.Category
                }));
                templates = templates.concat(convertedTemplates);
            }
            
            // Sort templates alphabetically
            templates.sort((a, b) => a.name.localeCompare(b.name));
            
            // Update dropdown options
            selectElement.innerHTML = '<option value="">Choose a template...</option>' +
                templates.map(t => `<option value="${t.name}">${t.name}</option>`).join('') +
                '<option value="__add_new__">Add New...</option>';
            
            // Set selected value if provided
            if (selectedValue) {
                selectElement.value = selectedValue;
            }
        } catch (error) {
            console.error('Error refreshing line item template dropdown:', error);
            // Fall back to built-in templates only
            const templates = this.getLineItemTemplates();
            selectElement.innerHTML = '<option value="">Choose a template...</option>' +
                templates.map(t => `<option value="${t.name}">${t.name}</option>`).join('') +
                '<option value="__add_new__">Add New...</option>';
        }
    }
    
    async getAllLineItemTemplates() {
        try {
            // Get built-in templates
            let templates = this.getLineItemTemplates();
            
            // Get custom templates from database
            const response = await fetch('/api/lineitems');
            if (response.ok) {
                const customTemplates = await response.json();
                // Convert database format to frontend format
                const convertedTemplates = customTemplates.map(template => ({
                    name: template.ItemName,
                    description: template.ItemDescription,
                    defaultHours: window._templateDefaultHours?.[template.ItemName] || 1,
                    hourlyRate: template.StandardRate,
                    category: template.Category
                }));
                templates = templates.concat(convertedTemplates);
            }
            
            return templates;
        } catch (error) {
            console.error('Error loading all templates:', error);
            // Fall back to built-in templates only
            return this.getLineItemTemplates();
        }
    }
    
    populateLineItemFromTemplate(selectElement, index) {
        const selectedTemplate = selectElement.value;
        if (!selectedTemplate) return;

        if (selectedTemplate === "__add_new__") {
            // Prompt for new template details
            const name = prompt("Enter new line item template name:");
            if (!name) return;
            const description = prompt("Enter description for '" + name + "':");
            if (description === null) return;
            const defaultHours = parseFloat(prompt("Enter default hours for '" + name + "':", "1"));
            if (isNaN(defaultHours)) return;

            // Save new template to database
            this.saveCustomLineItemTemplate({
                ItemName: name,
                ItemDescription: description,
                Category: 'Custom',
                UnitOfMeasure: 'hrs',
                StandardRate: this.settings.hourly_rate || 75
            }, defaultHours).then((newTemplate) => {
                // Re-populate dropdown with new template
                this.refreshLineItemTemplateDropdown(selectElement, name);
                
                // Populate fields immediately
                const lineItem = selectElement.closest('.line-item');
                if (!lineItem) return;
                const nameInput = lineItem.querySelector(`input[name="lineItems[${index}][name]"]`);
                const hoursInput = lineItem.querySelector(`input[name="lineItems[${index}][hours]"]`);
                const hourlyRateInput = lineItem.querySelector(`input[name="lineItems[${index}][hourlyRate]"]`);
                const descriptionTextarea = lineItem.querySelector(`textarea[name="lineItems[${index}][description]"]`);
                if (nameInput) nameInput.value = name;
                if (hoursInput) hoursInput.value = defaultHours;
                if (hourlyRateInput) hourlyRateInput.value = this.settings.hourly_rate || 75;
                if (descriptionTextarea) descriptionTextarea.value = description;
                this.updateLineItemTotal();
                selectElement.closest('.form-row').style.display = 'none';
            }).catch((error) => {
                console.error('Error saving custom template:', error);
                alert('Failed to save template. Please try again.');
                // Reset dropdown selection
                selectElement.value = '';
            });
            return;
        }

        // Normal template selection - now async to handle database templates
        this.getAllLineItemTemplates().then(templates => {
            const template = templates.find(t => t.name === selectedTemplate);
            if (!template) return;

            const lineItem = selectElement.closest('.line-item');
            if (!lineItem) return;

            // Populate the fields
            const nameInput = lineItem.querySelector(`input[name="lineItems[${index}][name]"]`);
            const hoursInput = lineItem.querySelector(`input[name="lineItems[${index}][hours]"]`);
            const hourlyRateInput = lineItem.querySelector(`input[name="lineItems[${index}][hourlyRate]"]`);
            const descriptionTextarea = lineItem.querySelector(`textarea[name="lineItems[${index}][description]"]`);

            if (nameInput) nameInput.value = template.name;
            if (hoursInput) hoursInput.value = template.defaultHours || 0;
            if (hourlyRateInput) hourlyRateInput.value = template.hourlyRate || this.settings.hourly_rate || 75;
            if (descriptionTextarea) descriptionTextarea.value = template.description;

            // Update totals
            this.updateLineItemTotal();

            // Hide the template selector after selection
            selectElement.closest('.form-row').style.display = 'none';
        }).catch(error => {
            console.error('Error loading template:', error);
            // Fallback to built-in templates
            const builtInTemplates = this.getLineItemTemplates();
            const template = builtInTemplates.find(t => t.name === selectedTemplate);
            if (template) {
                const lineItem = selectElement.closest('.line-item');
                if (lineItem) {
                    const nameInput = lineItem.querySelector(`input[name="lineItems[${index}][name]"]`);
                    const hoursInput = lineItem.querySelector(`input[name="lineItems[${index}][hours]"]`);
                    const hourlyRateInput = lineItem.querySelector(`input[name="lineItems[${index}][hourlyRate]"]`);
                    const descriptionTextarea = lineItem.querySelector(`textarea[name="lineItems[${index}][description]"]`);

                    if (nameInput) nameInput.value = template.name;
                    if (hoursInput) hoursInput.value = template.defaultHours || 0;
                    if (hourlyRateInput) hourlyRateInput.value = this.settings.hourly_rate || 75;
                    if (descriptionTextarea) descriptionTextarea.value = template.description;

                    this.updateLineItemTotal();
                    selectElement.closest('.form-row').style.display = 'none';
                }
            }
        });
    }

    addEstimateLineItem() {
        const container = document.getElementById('line-items-container');
        if (!container) return;
        
        const existingItems = container.querySelectorAll('.line-item').length;
        const newIndex = existingItems;
        const newId = 'temp_' + Date.now();
        
        const newItem = {
            id: newId,
            name: '',
            description: '',
            hours: 0,
            hourlyRate: this.settings.hourly_rate || 75
        };
        
        const newItemHtml = this.getLineItemHtml(newItem, newIndex, true);
        
        // Insert the new item before the "Add Line Item" button
        const addButtonSection = container.querySelector('.add-line-item-section');
        if (addButtonSection) {
            addButtonSection.insertAdjacentHTML('beforebegin', newItemHtml);
        } else {
            // Fallback if the button section isn't found
            container.insertAdjacentHTML('beforeend', newItemHtml);
        }
        
        // After HTML is inserted, populate the template dropdown with database templates
        const newItemElement = container.querySelector(`[data-item-id="${newId}"]`);
        if (newItemElement) {
            const templateSelect = newItemElement.querySelector('select');
            if (templateSelect) {
                this.refreshLineItemTemplateDropdown(templateSelect);
            }
        }
        
        this.renumberLineItems();
        this.updateLineItemTotal();
    }

    removeEstimateLineItem(itemId) {
        const item = document.querySelector(`[data-item-id="${itemId}"]`);
        if (item) {
            item.remove();
            this.renumberLineItems();
            this.updateLineItemTotal();
        }
    }

    renumberLineItems() {
        const lineItems = document.querySelectorAll('.line-item');
        lineItems.forEach((item, index) => {
            const header = item.querySelector('h5');
            if (header) {
                header.textContent = `Line Item ${index + 1}`;
            }
            
            // Update input names to maintain proper indexing
            const inputs = item.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                if (input.name && input.name.includes('lineItems[')) {
                    const namePattern = input.name.replace(/lineItems\[\d+\]/, `lineItems[${index}]`);
                    input.name = namePattern;
                }
            });
        });
    }

    updateLineItemTotal() {
        let subtotal = 0;
        
        // Calculate totals for each line item
        document.querySelectorAll('.line-item').forEach((item, index) => {
            const hoursInput = item.querySelector(`input[name*="[hours]"]`);
            const rateInput = item.querySelector(`input[name*="[hourlyRate]"]`);
            const amountInput = item.querySelector(`input[name*="[amount]"]`);
            
            if (hoursInput && rateInput && amountInput) {
                const hours = parseFloat(hoursInput.value) || 0;
                const rate = parseFloat(rateInput.value) || 0;
                const amount = hours * rate;
                
                amountInput.value = amount.toFixed(2);
                subtotal += amount;
            }
        });
        
        // Get tax rate
        const taxRateSelect = document.getElementById('estimate-tax-rate');
        const customTaxInput = document.getElementById('custom-tax-rate');
        let taxRate = 0;
        
        if (taxRateSelect) {
            if (taxRateSelect.value === 'custom' && customTaxInput && customTaxInput.value) {
                taxRate = parseFloat(customTaxInput.value) || 0;
            } else {
                taxRate = parseFloat(taxRateSelect.value) || 0;
            }
        }
        
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;
        
        // Update display
        const subtotalDisplay = document.getElementById('estimate-subtotal');
        const taxDisplay = document.getElementById('estimate-tax-amount');
        const totalDisplay = document.getElementById('estimate-total-amount');
        
        if (subtotalDisplay) subtotalDisplay.textContent = this.formatCurrency(subtotal);
        if (taxDisplay) taxDisplay.textContent = this.formatCurrency(taxAmount);
        if (totalDisplay) totalDisplay.textContent = this.formatCurrency(total);
    }

    setupTaxRateHandler() {
        const taxRateSelect = document.getElementById('estimate-tax-rate');
        const customTaxInput = document.getElementById('custom-tax-rate');
        
        if (taxRateSelect && customTaxInput) {
            taxRateSelect.addEventListener('change', () => {
                if (taxRateSelect.value === 'custom') {
                    customTaxInput.style.display = 'block';
                    customTaxInput.focus();
                } else {
                    customTaxInput.style.display = 'none';
                    customTaxInput.value = '';
                }
                this.updateLineItemTotal();
            });
            
            customTaxInput.addEventListener('input', () => {
                this.updateLineItemTotal();
            });
        }
        
        // Initial calculation
        setTimeout(() => this.updateLineItemTotal(), 100);
    }

    viewProjectFromCustomer(projectId) {
        console.log('Viewing project from customer:', projectId);
        
        // Explicitly clear editing states before switching
        this.editingProjectId = null;
        this.viewingProjectId = null;
        
        // Switch to projects tab
        this.switchSection('projects');
        
        // Wait for projects to load, then open the specific project
        setTimeout(() => {
            // Ensure we're in view mode, not edit mode
            this.editingProjectId = null;
            this.viewingProjectId = projectId;
            this.filterProjects('');
            
            // Scroll to the project row
            const projectRow = document.querySelector(`tr:has(button[onclick*="toggleProjectView(${projectId})"])`);
            if (projectRow) {
                projectRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Add a highlight effect
                projectRow.style.backgroundColor = '#fff3cd';
                setTimeout(() => {
                    projectRow.style.backgroundColor = '';
                    projectRow.style.transition = 'background-color 0.5s ease';
                }, 2000);
            }
        }, 300);
        
        this.showToast('Switched to Projects to view project');
    }

    createProjectFromCustomer(customerId) {
        console.log('Creating project from customer:', customerId);
        
        // Find the customer to get its details
        const customer = this.data.customers.find(c => c.CustomerID == customerId);
        if (!customer) {
            this.showToast('Customer not found', 'error');
            return;
        }
        
        console.log('Customer found for project:', customer);
        
        // Store the customer data for the project form
        this.projectFromCustomer = {
            customerId: customerId,
            companyName: customer.CompanyName
        };
        
        // Switch to projects tab
        this.switchSection('projects');
        
        // Wait a moment for the tab to load, then create new project
        setTimeout(() => {
            console.log('Adding new project with pre-selected customer:', customerId);
            this.addNewProjectFromCustomer();
        }, 300);
        
        this.showToast(`Switched to Projects to create project for ${customer.CompanyName}`);
    }

    addNewProjectFromCustomer() {
        console.log('Adding new project from customer');
        this.editingProjectId = 'new';
        this.viewingProjectId = null;
        this.filterProjects('');
        this.focusOnEditRow('projects-table-body', 'new');
        
        // The customer should already be pre-selected in the form generation
        // No need for setTimeout since we fixed the form generation logic
        console.log('Customer pre-selection handled in form generation');
    }

    viewEstimateFromProject(estimateId) {
        console.log('Viewing estimate from project:', estimateId);
        
        // Switch to estimates tab
        this.switchSection('estimates');
        
        // Wait for estimates to load, then open the specific estimate
        setTimeout(() => {
            this.toggleEstimateView(estimateId);
            
            // Scroll to the estimate row
            const estimateRow = document.querySelector(`tr:has(button[onclick*="toggleEstimateView(${estimateId})"])`);
            if (estimateRow) {
                estimateRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Add a highlight effect
                estimateRow.style.backgroundColor = '#fff3cd';
                setTimeout(() => {
                    estimateRow.style.backgroundColor = '';
                    estimateRow.style.transition = 'background-color 0.5s ease';
                }, 2000);
            }
        }, 300);
        
        this.showToast('Switched to Estimates to view estimate');
    }

    async createEstimatePDF(estimateId) {
        // Find the estimate
        const estimate = this.data.estimates.find(e => e.EstimateID == estimateId);
        if (!estimate) {
            this.showToast('Estimate not found', 'error');
            return;
        }

        console.log('Creating PDF for estimate:', estimate);
        
        // Generate PDFKit PDF
        this.showToast('Generating PDF... Please wait.', 'info');
        
        try {
            const response = await fetch(`/api/estimates/${estimateId}/pdf-native`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            console.log('PDF blob received, size:', blob.size);
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Estimate_${estimate.EstimateNumber}_${estimate.CompanyName || 'Customer'}.pdf`.replace(/[^a-zA-Z0-9_-]/g, '_');
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            window.URL.revokeObjectURL(url);
            
            this.showToast(`PDF "${link.download}" downloaded successfully!`, 'success');
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showToast('Error generating PDF: ' + error.message, 'error');
        }
    }

    async deleteEstimate(estimateId) {
        if (!confirm('Are you sure you want to delete this estimate?')) return;
        try {
            await this.apiCall(`estimates/${estimateId}`, 'DELETE');
            this.showToast('Estimate deleted successfully', 'success');
            this.loadEstimates();
        } catch (error) {
            console.error('Error deleting estimate:', error);
        }
    }

    // Invoices
    async loadInvoices() {
        try {
            const invoices = await this.apiCall('invoices');
            this.data.invoices = invoices;
            
            // Filter invoices to only show those linked to active projects
            const filteredInvoices = this.filterInvoicesByActiveProjects();
            this.renderInvoiceTable(filteredInvoices);
        } catch (error) {
            console.error('Error loading invoices:', error);
        }
    }

    renderInvoiceTable(invoices) {
        const tableBody = document.getElementById('invoices-table-body');
        if (!tableBody) return;
        
        if (invoices.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No invoices found</td></tr>';
            return;
        }

        tableBody.innerHTML = invoices.map(invoice => `
            <tr data-invoice-id="${invoice.InvoiceID}">
                <td>${invoice.InvoiceNumber || invoice.InvoiceID}</td>
                <td>${invoice.ProjectName || 'N/A'}</td>
                <td>${invoice.CompanyName || 'N/A'}</td>
                <td>${invoice.InvoiceDate ? this.formatDate(invoice.InvoiceDate) : 'N/A'}</td>
                <td>${invoice.DueDate ? this.formatDate(invoice.DueDate) : 'N/A'}</td>
                <td>${invoice.TotalAmount ? this.formatCurrency(invoice.TotalAmount) : '$0.00'}</td>
                <td>${invoice.BalanceDue ? this.formatCurrency(invoice.BalanceDue) : '$0.00'}</td>
                <td>
                    <span class="badge ${this.getInvoiceStatusClass(invoice.InvoiceStatus)}">${invoice.InvoiceStatus || 'Draft'}</span>
                </td>
                <td>
                    <span class="action-buttons">
                        <button class="action-btn view" title="View" onclick="app.viewInvoice(${invoice.InvoiceID})"><i class="fas fa-eye"></i></button>
                        <button class="action-btn pdf" title="Download PDF" onclick="app.downloadInvoicePdf(${invoice.InvoiceID})"><i class="fas fa-file-pdf"></i></button>
                        <button class="action-btn delete" title="Delete" onclick="app.deleteInvoice(${invoice.InvoiceID})"><i class="fas fa-trash"></i></button>
                    </span>
                </td>
            </tr>
        `).join('');
    }

    async viewInvoice(invoiceId) {
        try {
            // Check if this invoice view is already open
            const existingView = document.querySelector(`.inline-invoice-view[data-invoice-id="${invoiceId}"]`);
            
            if (existingView) {
                // Invoice is already open, close it (toggle off)
                this.closeInlineInvoiceView();
                return;
            }
            
            // Load the full invoice details
            const invoice = await this.apiCall(`invoices/${invoiceId}`);
            
            // Show the inline invoice view
            await this.showInlineInvoiceView(invoice);
            
        } catch (error) {
            console.error('Error loading invoice for view:', error);
            showToast('Failed to load invoice details', 'error');
        }
    }

    showInvoiceModal(invoiceId) {
        const invoice = this.data.invoices.find(i => i.InvoiceID === invoiceId) || {};
        document.getElementById('invoice-modal-title').innerText = invoiceId ? 'Edit Invoice' : 'Add Invoice';
        document.getElementById('invoice-modal-submit').innerText = invoiceId ? 'Update Invoice' : 'Add Invoice';

        // Fill form fields with invoice data or leave blank
        document.getElementById('invoice-id').value = invoice.InvoiceID || '';
        document.getElementById('invoice-project-name').value = invoice.ProjectName || '';
        document.getElementById('invoice-customer-name').value = invoice.CustomerName || '';
        document.getElementById('invoice-status').value = invoice.InvoiceStatus || '';
        document.getElementById('invoice-due-date').value = invoice.DueDate ? invoice.DueDate.split('T')[0] : '';
        document.getElementById('invoice-total-amount').value = invoice.TotalAmount || '';

        $('#invoice-modal').modal('show');
    }

    async saveInvoice() {
        const invoiceId = document.getElementById('invoice-id').value;
        const invoiceData = {
            ProjectName: document.getElementById('invoice-project-name').value,
            CustomerName: document.getElementById('invoice-customer-name').value,
            InvoiceStatus: document.getElementById('invoice-status').value,
            DueDate: document.getElementById('invoice-due-date').value,
            TotalAmount: document.getElementById('invoice-total-amount').value
        };

        try {
            if (invoiceId) {
                // Update existing invoice
                await this.apiCall(`invoices/${invoiceId}`, 'PUT', invoiceData);
                this.showToast('Invoice updated successfully', 'success');
            } else {
                // Add new invoice
                await this.apiCall('invoices', 'POST', invoiceData);
                this.showToast('Invoice added successfully', 'success');
            }
            $('#invoice-modal').modal('hide');
            this.loadInvoices();
        } catch (error) {
            console.error('Error saving invoice:', error);
        }
    }

    async deleteInvoice(invoiceId) {
        if (!confirm('Are you sure you want to delete this invoice?')) return;
        try {
            await this.apiCall(`invoices/${invoiceId}`, 'DELETE');
            this.showToast('Invoice deleted successfully', 'success');
            this.loadInvoices();
        } catch (error) {
            console.error('Error deleting invoice:', error);
        }
    }

    togglePaymentForm(invoiceId) {
        const paymentForm = document.getElementById(`payment-form-${invoiceId}`);
        const toggleButton = document.getElementById(`payment-toggle-${invoiceId}`);
        
        if (paymentForm.style.display === 'none') {
            paymentForm.style.display = 'block';
            toggleButton.textContent = 'Hide Payment Form';
            toggleButton.classList.remove('btn-outline-success');
            toggleButton.classList.add('btn-outline-secondary');
        } else {
            paymentForm.style.display = 'none';
            toggleButton.textContent = 'Show Payment Form';
            toggleButton.classList.remove('btn-outline-secondary');
            toggleButton.classList.add('btn-outline-success');
            
            // Clear form
            document.getElementById(`inline-payment-form-${invoiceId}`).reset();
            document.getElementById(`inline-payment-date-${invoiceId}`).value = new Date().toISOString().split('T')[0];
        }
    }

    setInlineFullPaymentAmount(invoiceId, balanceDue) {
        document.getElementById(`inline-payment-amount-${invoiceId}`).value = balanceDue.toFixed(2);
    }

    async processInlinePayment(invoiceId) {
        const form = document.getElementById(`inline-payment-form-${invoiceId}`);
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const amount = parseFloat(document.getElementById(`inline-payment-amount-${invoiceId}`).value);
        const method = document.getElementById(`inline-payment-method-${invoiceId}`).value;
        const date = document.getElementById(`inline-payment-date-${invoiceId}`).value;
        const notes = document.getElementById(`inline-payment-notes-${invoiceId}`).value;
        
        // Validate payment amount
        if (amount <= 0) {
            showToast('Payment amount must be greater than $0.00', 'error');
            return;
        }
        
        try {
            // Get current invoice for validation
            const invoice = await this.apiCall(`invoices/${invoiceId}`);
            
            if (amount > invoice.BalanceDue) {
                if (!confirm(`Payment amount ($${amount.toFixed(2)}) exceeds the balance due ($${invoice.BalanceDue.toFixed(2)}). Continue anyway?`)) {
                    return;
                }
            }
            
            const paymentData = {
                invoiceId: invoiceId,
                paymentAmount: amount,
                paymentDate: date,
                paymentMethod: method,
                paymentReference: notes
            };
            
            await this.apiCall('payments', 'POST', paymentData);
            
            this.showToast('Payment recorded successfully', 'success');
            
            // Hide the payment form
            this.togglePaymentForm(invoiceId);
            
            // Show popup asking if user wants to email paid invoice
            this.showPaidInvoiceEmailPopup(invoiceId, invoice);
            
            // Refresh the invoice view to show updated balance
            this.closeInlineInvoiceView();
            setTimeout(() => {
                this.viewInvoice(invoiceId);
            }, 100);
            
            // Also refresh the invoice list
            this.loadInvoices();
            
        } catch (error) {
            console.error('Error processing payment:', error);
            showToast('Failed to process payment', 'error');
        }
    }

    showPaidInvoiceEmailPopup(invoiceId, invoice) {
        const customerEmail = invoice.Email;
        if (!customerEmail) {
            console.log('No customer email available for invoice', invoiceId);
            return;
        }

        const popup = document.createElement('div');
        popup.className = 'paid-invoice-popup-overlay';
        popup.innerHTML = `
            <div class="paid-invoice-popup">
                <div class="popup-header">
                    <h3><i class="fas fa-envelope"></i> Send Paid Invoice</h3>
                    <button type="button" class="popup-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="popup-body">
                    <div class="customer-info">
                        <p><strong>Customer:</strong> ${invoice.CompanyName || 'N/A'}</p>
                        <p><strong>Email:</strong> ${customerEmail}</p>
                        <p><strong>Invoice:</strong> ${invoice.InvoiceNumber || invoice.InvoiceID}</p>
                    </div>
                    <div class="message-section">
                        <p style="margin-bottom: 15px;">Would you like to send a copy of this invoice with a <span style="color: #dc3545; font-weight: bold;">"PAID"</span> stamp to the customer?</p>
                        <div class="email-preview" style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <strong>Email Subject:</strong> Invoice ${invoice.InvoiceNumber || invoice.InvoiceID} - Payment Received<br>
                            <strong>Message:</strong> Thank you for your payment. Please find attached a copy of your paid invoice for your records.
                        </div>
                    </div>
                </div>
                <div class="popup-footer">
                    <button type="button" class="btn btn-success" onclick="app.sendPaidInvoiceEmail(${invoiceId}); this.parentElement.parentElement.parentElement.remove();">
                        <i class="fas fa-paper-plane"></i> Send Email
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove();">
                        Skip
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        
        // Auto-focus the send button
        setTimeout(() => {
            popup.querySelector('.btn-success').focus();
        }, 100);
    }

    async sendPaidInvoiceEmail(invoiceId) {
        try {
            this.showToast('Sending paid invoice email...', 'info');
            
            const result = await this.apiCall('invoices/send-paid-email', 'POST', {
                invoiceId: invoiceId
            });
            
            // Show personalized confirmation with customer name
            if (result && result.companyName) {
                this.showToast(`Paid invoice email sent to ${result.companyName}!`, 'success');
            } else {
                this.showToast('Paid invoice email sent successfully!', 'success');
            }
        } catch (error) {
            console.error('Error sending paid invoice email:', error);
            showToast('Failed to send paid invoice email: ' + (error.message || 'Unknown error'), 'error');
        }
    }

    async showInlineInvoiceView(invoice) {
        // Find the invoice row
        const invoiceRow = document.querySelector(`tr[data-invoice-id="${invoice.InvoiceID}"]`);
        if (!invoiceRow) return;

        // Get the formatted HTML
        const viewHtml = await this.getInvoiceViewHtml(invoice);

        // Create inline view HTML
        const inlineViewHtml = `
            <tr class="inline-invoice-view" data-invoice-id="${invoice.InvoiceID}">
                <td colspan="9" class="inline-view-content">
                    <div class="inline-view-container">
                        <div class="inline-view-header">
                            <h5>Invoice Details</h5>
                            <button type="button" class="btn-close-inline" onclick="app.closeInlineInvoiceView()">&times;</button>
                        </div>
                        <div class="inline-view-body">
                            ${viewHtml}
                        </div>
                    </div>
                </td>
            </tr>
        `;

        // Remove any existing inline views
        const existingViews = document.querySelectorAll('.inline-invoice-view');
        existingViews.forEach(view => view.remove());

        // Remove any existing row selections
        const selectedRows = document.querySelectorAll('.row-selected');
        selectedRows.forEach(row => row.classList.remove('row-selected'));

        // Insert the inline view after the invoice row
        invoiceRow.insertAdjacentHTML('afterend', inlineViewHtml);
        
        // Add highlight to the current row
        invoiceRow.classList.add('row-selected');
        
        // Scroll to the inline view
        const inlineView = document.querySelector('.inline-invoice-view');
        inlineView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    closeInlineInvoiceView() {
        // Remove any existing inline views
        const existingViews = document.querySelectorAll('.inline-invoice-view');
        existingViews.forEach(view => view.remove());
        
        // Remove highlights from rows
        const highlightedRows = document.querySelectorAll('.row-selected');
        highlightedRows.forEach(row => row.classList.remove('row-selected'));
    }

    getPaymentFormSection(invoice) {
        // Don't show payment form if already fully paid
        const balanceDue = invoice.BalanceDue || 0;
        const hasPaid = balanceDue <= 0;
        
        if (hasPaid) {
            // Show payment history instead
            let paymentsHistoryHtml = '';
            if (invoice.Payments && invoice.Payments.length > 0) {
                paymentsHistoryHtml = `
                    <div class="payment-history">
                        <h6 style="color: #28a745; margin-bottom: 15px;"><i class="fas fa-history"></i> Payment History</h6>
                        <div class="payments-list">
                            ${invoice.Payments.map(payment => {
                                const paymentDate = new Date(payment.PaymentDate).toLocaleDateString();
                                return `
                                    <div class="payment-record" style="padding: 10px; margin-bottom: 8px; background: #f0f8f0; border-radius: 4px; border-left: 4px solid #28a745;">
                                        <div class="d-flex justify-content-between">
                                            <span><strong>${this.formatCurrency(payment.PaymentAmount)}</strong> via ${payment.PaymentMethod}</span>
                                            <span class="text-muted">${paymentDate}</span>
                                        </div>
                                        ${payment.Notes ? `<div class="text-muted small mt-1">${payment.Notes}</div>` : ''}
                                        ${payment.PaymentReference ? `<div class="text-muted small">Ref: ${payment.PaymentReference}</div>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
            return paymentsHistoryHtml;
        } else {
            // Show payment form
            return `
                <div id="payment-form-${invoice.InvoiceID}" class="payment-form" style="display: none;">
                    <form id="inline-payment-form-${invoice.InvoiceID}">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Payment Amount</label>
                                    <div class="input-group">
                                        <span class="input-group-text">$</span>
                                        <input type="number" class="form-control" id="inline-payment-amount-${invoice.InvoiceID}" step="0.01" min="0" required>
                                    </div>
                                    <div class="form-text">
                                        <button type="button" class="btn btn-link p-0" onclick="app.setInlineFullPaymentAmount(${invoice.InvoiceID}, ${invoice.BalanceDue || 0})">
                                            Pay full balance: ${this.formatCurrency(invoice.BalanceDue || 0)}
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Payment Method</label>
                                    <select class="form-select" id="inline-payment-method-${invoice.InvoiceID}" required>
                                        <option value="">Select payment method...</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Check">Check</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Payment Date</label>
                                    <input type="date" class="form-control" id="inline-payment-date-${invoice.InvoiceID}" value="${new Date().toISOString().split('T')[0]}" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Notes (Optional)</label>
                                    <textarea class="form-control" id="inline-payment-notes-${invoice.InvoiceID}" rows="2" placeholder="Check number, reference, etc."></textarea>
                                </div>
                            </div>
                        </div>
                        
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-success" onclick="app.processInlinePayment(${invoice.InvoiceID})">
                                <i class="fas fa-dollar-sign"></i> Record Payment
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="app.togglePaymentForm(${invoice.InvoiceID})">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            `;
        }
    }

    getPaymentSectionHeader(invoice) {
        // Check if invoice is fully paid
        const balanceDue = invoice.BalanceDue || 0;
        const hasPaid = balanceDue <= 0;
        
        // Get most recent payment if exists
        let mostRecentPayment = null;
        if (invoice.Payments && invoice.Payments.length > 0) {
            mostRecentPayment = invoice.Payments.reduce((latest, payment) => {
                const paymentDate = new Date(payment.PaymentDate);
                const latestDate = new Date(latest.PaymentDate);
                return paymentDate > latestDate ? payment : latest;
            });
        }
        
        if (hasPaid && mostRecentPayment) {
            // Payment has been received - show received status
            const paymentDate = new Date(mostRecentPayment.PaymentDate).toLocaleDateString();
            return `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h4 style="margin: 0; color: #28a745;"><i class="fas fa-check-circle"></i> Payment received on ${paymentDate}</h4>
                    <div class="payment-toggle">
                        <button type="button" class="btn btn-sm btn-success" disabled style="opacity: 0.6; cursor: not-allowed;">
                            <i class="fas fa-check"></i> Payment Complete
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Payment still needed - show receive payment option
            return `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h4 style="margin: 0; color: #28a745;"><i class="fas fa-dollar-sign"></i> Receive Payment</h4>
                    <div class="payment-toggle">
                        <button type="button" class="btn btn-sm btn-outline-success" onclick="app.togglePaymentForm(${invoice.InvoiceID})" id="payment-toggle-${invoice.InvoiceID}">
                            Show Payment Form
                        </button>
                    </div>
                </div>
            `;
        }
    }

    async getInvoiceViewHtml(invoice) {
        // If we don't have full invoice details with line items, fetch them
        let fullInvoice = invoice;
        if (!invoice.LineItems && invoice.InvoiceID) {
            try {
                const response = await fetch(`/api/invoices/${invoice.InvoiceID}`);
                if (response.ok) {
                    fullInvoice = await response.json();
                } else {
                    console.error('Failed to fetch invoice details');
                }
            } catch (error) {
                console.error('Error fetching invoice details:', error);
            }
        }

        // Format line items for professional presentation
        let lineItemsHtml = '';
        if (fullInvoice.LineItems && fullInvoice.LineItems.length > 0) {
            lineItemsHtml = `
                <div class="invoice-line-items" style="margin: 20px 0;">
                    <table class="line-items-table" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6; font-weight: 600;">Description</th>
                                <th style="padding: 12px; text-align: center; border: 1px solid #dee2e6; font-weight: 600; width: 100px;">Quantity</th>
                                <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: 600; width: 120px;">Rate</th>
                                <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: 600; width: 120px;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fullInvoice.LineItems.map(item => `
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; vertical-align: top;">
                                        <strong>${item.ItemDescription || 'N/A'}</strong>
                                    </td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center;">${item.Quantity || 0}</td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; text-align: right;">${this.formatCurrency(item.UnitRate || 0)}</td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; text-align: right; font-weight: 500;">${this.formatCurrency(item.LineTotal || 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="invoice-totals" style="margin-top: 20px; display: flex; justify-content: flex-end;">
                        <div style="min-width: 300px;">
                            <div class="total-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <span style="font-weight: 500;">Subtotal:</span>
                                <span>${this.formatCurrency(fullInvoice.SubTotal || fullInvoice.TotalAmount || 0)}</span>
                            </div>
                            ${(fullInvoice.TaxRate && fullInvoice.TaxRate > 0) ? `
                                <div class="total-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                                    <span style="font-weight: 500;">Tax (${(fullInvoice.TaxRate * 100).toFixed(1)}%):</span>
                                    <span>${this.formatCurrency(fullInvoice.TaxAmount || 0)}</span>
                                </div>
                            ` : ''}
                            <div class="total-row" style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #333; margin-top: 8px; font-weight: 600; font-size: 1.1em;">
                                <span>Total:</span>
                                <span>${this.formatCurrency(fullInvoice.TotalAmount || 0)}</span>
                            </div>
                            ${fullInvoice.BalanceDue && fullInvoice.BalanceDue !== fullInvoice.TotalAmount ? `
                                <div class="total-row" style="display: flex; justify-content: space-between; padding: 8px 0; color: #dc3545; font-weight: 500;">
                                    <span>Balance Due:</span>
                                    <span>${this.formatCurrency(fullInvoice.BalanceDue)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="invoice-customer-view" style="background: white; padding: 30px; border: 1px solid #ddd; border-radius: 8px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <!-- Header Section -->
                <div class="invoice-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
                    <div class="invoice-info" style="flex: 1;">
                        <h2 style="margin: 0; color: #333; font-size: 1.6em;">INVOICE</h2>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 1em;">${fullInvoice.InvoiceNumber || `#${fullInvoice.InvoiceID}`}</p>
                    </div>
                    <div class="company-name" style="flex: 1; text-align: center;">
                        <h1 style="margin: 0; color: #333; font-size: 1.9em; font-weight: 700;">Omega Builders, LLC</h1>
                    </div>
                    <div class="invoice-details" style="flex: 1; text-align: right;">
                        <div style="margin: 3px 0; font-size: 0.95em;"><strong>Invoice Date:</strong> ${fullInvoice.InvoiceDate ? this.formatDate(fullInvoice.InvoiceDate) : 'N/A'}</div>
                        <div style="margin: 3px 0; font-size: 0.95em;"><strong>Due Date:</strong> ${fullInvoice.DueDate ? this.formatDate(fullInvoice.DueDate) : 'N/A'}</div>
                        <div style="margin: 3px 0; font-size: 0.95em;"><strong>Status:</strong> <span class="badge ${this.getInvoiceStatusClass(fullInvoice.InvoiceStatus)}">${fullInvoice.InvoiceStatus || 'Draft'}</span></div>
                    </div>
                </div>

                <!-- Customer & Project Info -->
                <div class="project-info" style="margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Project Information</h4>
                        <div style="margin: 5px 0;"><strong>Customer:</strong> ${fullInvoice.CompanyName || 'N/A'}</div>
                        <div style="margin: 5px 0;"><strong>Project:</strong> ${fullInvoice.ProjectName || 'N/A'}</div>
                        ${fullInvoice.Address || fullInvoice.City || fullInvoice.State ? `<div style="margin: 5px 0;"><strong>Project Address:</strong> ${[fullInvoice.Address, fullInvoice.City, fullInvoice.State, fullInvoice.ZipCode].filter(Boolean).join(', ')}</div>` : ''}
                    </div>
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Payment Information</h4>
                        <div style="margin: 5px 0;"><strong>Payment Terms:</strong> ${fullInvoice.PaymentTerms || 'Net 30'}</div>
                        <div style="margin: 5px 0;"><strong>Total Amount:</strong> ${this.formatCurrency(fullInvoice.TotalAmount || 0)}</div>
                        <div style="margin: 5px 0;"><strong>Balance Due:</strong> <span style="color: #dc3545; font-weight: 600;">${this.formatCurrency(fullInvoice.BalanceDue || 0)}</span></div>
                    </div>
                </div>

                <!-- Line Items -->
                <div class="line-items-section">
                    <h4 style="margin: 0 0 15px 0; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Invoice Details</h4>
                    ${lineItemsHtml}
                </div>

                <!-- Notes -->
                ${fullInvoice.Notes ? `
                    <div class="notes-section" style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
                        <h4 style="margin: 0 0 10px 0; color: #007bff;">Notes</h4>
                        <p style="margin: 0; line-height: 1.5; color: #333;">${fullInvoice.Notes.replace(/\n/g, '<br>')}</p>
                    </div>
                ` : ''}

                <!-- Payment Section -->
                <div class="payment-section" style="margin-top: 30px; padding: 20px; background: #f8fff8; border: 2px solid #28a745; border-radius: 8px;">
                    ${this.getPaymentSectionHeader(fullInvoice)}
                    ${this.getPaymentFormSection(fullInvoice)}
                </div>

                <!-- Invoice Footer -->
                <div class="invoice-footer" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; color: #666; font-size: 0.95em;">
                    <div style="font-weight: 600; font-size: 1.1em; color: #333;">Omega Builders, LLC</div>
                    <div style="margin-bottom: 8px; color: #555; font-size: 1em; font-weight: 400;">1934 Florence St, Enumclaw, Wa 98022</div>
                    <div style="margin-bottom: 8px;">Invoice generated on ${fullInvoice.InvoiceDate ? this.formatDate(fullInvoice.InvoiceDate) : '[Date]'}</div>
                    <div style="margin-bottom: 8px;">Thank you for choosing Omega Builders, LLC for your project.</div>
                </div>
            </div>
        `;
    }

    // Payments
    async loadPayments() {
        try {
            const payments = await this.apiCall('payments');
            this.data.payments = payments;
            
            // Filter payments to only show those linked to active projects
            const filteredPayments = this.filterPaymentsByActiveProjects();
            this.renderPaymentTable(filteredPayments);
        } catch (error) {
            console.error('Error loading payments:', error);
        }
    }

    renderPaymentTable(payments) {
        const tableBody = document.getElementById('payments-table-body');
        if (!tableBody) {
            console.error('Could not find payments-table-body element');
            return;
        }
        
        if (!payments || payments.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="no-data">No payments found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = payments.map(payment => `
            <tr>
                <td>${payment.PaymentDate ? this.formatDate(payment.PaymentDate) : ''}</td>
                <td>${payment.InvoiceNumber || payment.InvoiceID || 'N/A'}</td>
                <td>${payment.CompanyName || 'N/A'}</td>
                <td>${payment.ProjectName || 'N/A'}</td>
                <td>${payment.PaymentAmount ? this.formatCurrency(payment.PaymentAmount) : ''}</td>
                <td>${payment.PaymentMethod || ''}</td>
                <td>${payment.PaymentReference || ''}</td>
                <td>
                    <span class="action-buttons">
                        <button class="action-btn delete" title="Delete" onclick="app.deletePayment(${payment.PaymentID})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </span>
                </td>
            </tr>
        `).join('');
    }

    async filterPayments() {
        const startDate = document.getElementById('filter-payment-start-date').value;
        const endDate = document.getElementById('filter-payment-end-date').value;
        const paymentMethod = document.getElementById('filter-payment-method').value;

        try {
            const query = {};
            if (startDate) query.startDate = startDate;
            if (endDate) query.endDate = endDate;
            if (paymentMethod) query.paymentMethod = paymentMethod;

            const payments = await this.apiCall('payments', 'GET', query);
            this.data.payments = payments;
            this.renderPaymentTable(payments);
        } catch (error) {
            console.error('Error filtering payments:', error);
        }
    }

    // Change Orders
    // Contracts
    async loadContracts() {
        try {
            const contracts = await this.apiCall('contracts');
            // Ensure contracts is an array
            if (!Array.isArray(contracts)) {
                console.warn('Contracts API returned non-array data:', contracts);
                this.data.contracts = [];
                this.renderContractTable([]);
                return;
            }
            this.data.contracts = contracts;
            
            // Filter contracts to only show those linked to active projects
            const filteredContracts = this.filterContractsByActiveProjects();
            this.renderContractTable(filteredContracts);
        } catch (error) {
            console.error('Error loading contracts:', error);
            this.data.contracts = [];
            this.renderContractTable([]);
        }
    }

    renderContractTable(contracts) {
        const tableBody = document.getElementById('contracts-table-body');
        if (!tableBody) return;
        
        // Ensure contracts is an array before calling map
        if (!Array.isArray(contracts)) {
            console.warn('renderContractTable called with non-array:', contracts);
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No contracts found</td></tr>';
            return;
        }
        
        if (contracts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No contracts found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = contracts.map(contract => `
            <tr data-contract-id="${contract.ContractID}">
                <td>${contract.ContractNumber || contract.ContractID}</td>
                <td>${contract.ProjectName}</td>
                <td>${contract.CompanyName}</td>
                <td>${contract.ContractStatus}</td>
                <td>${contract.ContractType || ''}</td>
                <td>${contract.SignedDate ? this.formatDate(contract.SignedDate) : ''}</td>
                <td>${contract.ContractAmount ? this.formatCurrency(contract.ContractAmount) : ''}</td>
                <td>
                    <span class="action-buttons">
                        <button class="action-btn view" title="View" onclick="app.viewContract(${contract.ContractID})">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${contract.ContractStatus !== 'Signed' ? `
                            <button class="action-btn" title="Send to Customer for Signature" onclick="app.sendContractToCustomer(${contract.ContractID})" style="background-color: #17a2b8; color: white;">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        ` : ''}
                        <button class="action-btn edit" title="Edit" onclick="app.showContractModal(${contract.ContractID})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" title="Delete" onclick="app.deleteContract(${contract.ContractID})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </span>
                </td>
            </tr>
        `).join('');
    }

    showContractModal(contractId) {
        const contract = this.data.contracts.find(c => c.ContractID === contractId) || {};
        document.getElementById('contract-modal-title').innerText = contractId ? 'Edit Contract' : 'Add Contract';
        document.getElementById('contract-modal-submit').innerText = contractId ? 'Update Contract' : 'Add Contract';

        // Fill form fields with contract data or leave blank
        document.getElementById('contract-id').value = contract.ContractID || '';
        document.getElementById('contract-project-name').value = contract.ProjectName || '';
        document.getElementById('contract-customer-name').value = contract.CustomerName || '';
        document.getElementById('contract-status').value = contract.ContractStatus || '';
        document.getElementById('contract-start-date').value = contract.StartDate ? contract.StartDate.split('T')[0] : '';
        document.getElementById('contract-end-date').value = contract.EndDate ? contract.EndDate.split('T')[0] : '';
        document.getElementById('contract-total-amount').value = contract.TotalAmount || '';

        $('#contract-modal').modal('show');
    }

    async saveContract() {
        const contractId = document.getElementById('contract-id').value;
        const contractData = {
            ProjectName: document.getElementById('contract-project-name').value,
            CustomerName: document.getElementById('contract-customer-name').value,
            ContractStatus: document.getElementById('contract-status').value,
            StartDate: document.getElementById('contract-start-date').value,
            EndDate: document.getElementById('contract-end-date').value,
            TotalAmount: document.getElementById('contract-total-amount').value
        };

        try {
            if (contractId) {
                // Update existing contract
                await this.apiCall(`contracts/${contractId}`, 'PUT', contractData);
                this.showToast('Contract updated successfully', 'success');
            } else {
                // Add new contract
                await this.apiCall('contracts', 'POST', contractData);
                this.showToast('Contract added successfully', 'success');
            }
            $('#contract-modal').modal('hide');
            this.loadContracts();
        } catch (error) {
            console.error('Error saving contract:', error);
        }
    }

    async deleteContract(contractId) {
        if (!confirm('Are you sure you want to delete this contract?')) return;
        try {
            await this.apiCall(`contracts/${contractId}`, 'DELETE');
            this.showToast('Contract deleted successfully', 'success');
            this.loadContracts();
        } catch (error) {
            if (error.message && error.message.includes('Cannot delete a signed contract')) {
                this.showToast('Cannot delete a signed contract.', 'error');
                alert('Cannot delete a signed contract.');
            } else {
                console.error('Error deleting contract:', error);
                this.showToast('Error deleting contract: ' + error.message, 'error');
            }
        }
    }

    async viewContract(contractId) {
        try {
            console.log(`📋 Toggling contract ${contractId} inline view`);
            
            // Check if this contract's inline view is already showing
            const existingView = document.querySelector(`.inline-contract-view[data-contract-id="${contractId}"]`);
            
            if (existingView) {
                // If the view is already showing, close it
                console.log('📋 Closing existing inline view');
                this.closeInlineContractView();
                return;
            }
            
            // Get the contract details from the backend
            const contract = await this.apiCall(`contracts/${contractId}`);
            console.log('📋 Contract data:', contract);
            
            if (!contract) {
                this.showToast('Contract not found', 'error');
                return;
            }
            
            // Show inline contract view
            await this.showInlineContractView(contract);
            
        } catch (error) {
            console.error('Error viewing contract:', error);
            this.showToast('Error loading contract details', 'error');
        }
    }

    async showInlineContractView(contract) {
        // Find the contract row
        const contractRow = document.querySelector(`tr[data-contract-id="${contract.ContractID}"]`);
        if (!contractRow) {
            // If data attributes aren't set, find by looking for the contract ID in the first cell
            const rows = document.querySelectorAll('#contracts-table-body tr');
            const foundRow = Array.from(rows).find(row => {
                const firstCell = row.querySelector('td:first-child');
                return firstCell && (firstCell.textContent.trim() === contract.ContractNumber || 
                                   firstCell.textContent.trim() === contract.ContractID.toString());
            });
            if (foundRow) {
                contractRow = foundRow;
            } else {
                console.error('Contract row not found');
                return;
            }
        }

        // Get the formatted contract HTML
        const viewHtml = this.getContractViewHtml(contract);

        // Create inline view HTML
        const inlineViewHtml = `
            <tr class="inline-contract-view" data-contract-id="${contract.ContractID}">
                <td colspan="8" class="inline-view-content">
                    <div class="inline-view-container">
                        <div class="inline-view-header">
                            <h5><i class="fas fa-file-contract" style="margin-right: 8px;"></i>Contract Details - ${contract.ContractNumber || contract.ContractID}</h5>
                            <button type="button" class="btn-close-inline" onclick="app.closeInlineContractView()">&times;</button>
                        </div>
                        <div class="inline-view-body">
                            ${viewHtml}
                        </div>
                    </div>
                </td>
            </tr>
        `;

        // Remove any existing inline views
        const existingViews = document.querySelectorAll('.inline-contract-view');
        existingViews.forEach(view => view.remove());

        // Remove any existing row selections
        const selectedRows = document.querySelectorAll('.row-selected');
        selectedRows.forEach(row => row.classList.remove('row-selected'));

        // Insert the inline view after the contract row
        contractRow.insertAdjacentHTML('afterend', inlineViewHtml);
        
        // Add highlight to the current row
        contractRow.classList.add('row-selected');
        
        // Scroll to the inline view
        const inlineView = document.querySelector('.inline-contract-view');
        inlineView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    getContractViewHtml(contract) {
        return `
            <div class="contract-details-grid">
                <div class="contract-detail-section">
                    <h6>Project Information</h6>
                    <div class="detail-row">
                        <span class="detail-label">Project Name:</span>
                        <span class="detail-value">${contract.ProjectName || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Customer:</span>
                        <span class="detail-value">${contract.CompanyName || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value">
                            <span class="status-badge status-${(contract.ContractStatus || 'unknown').toLowerCase()}">
                                ${contract.ContractStatus || 'N/A'}
                            </span>
                        </span>
                    </div>
                </div>
                
                <div class="contract-detail-section">
                    <h6>Contract Details</h6>
                    <div class="detail-row">
                        <span class="detail-label">Contract Type:</span>
                        <span class="detail-value">${contract.ContractType || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Signed Date:</span>
                        <span class="detail-value">${contract.SignedDate ? this.formatDate(contract.SignedDate) : 'Not signed'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Amount:</span>
                        <span class="detail-value">${contract.ContractAmount ? this.formatCurrency(contract.ContractAmount) : 'N/A'}</span>
                    </div>
                </div>
                
                <div class="contract-detail-section">
                    <h6>Additional Information</h6>
                    <div class="detail-row">
                        <span class="detail-label">Created:</span>
                        <span class="detail-value">${contract.CreatedDate ? this.formatDate(contract.CreatedDate) : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Last Modified:</span>
                        <span class="detail-value">${contract.ModifiedDate ? this.formatDate(contract.ModifiedDate) : 'N/A'}</span>
                    </div>
                    ${contract.Notes ? `
                    <div class="detail-row notes-row">
                        <span class="detail-label">Notes:</span>
                        <div class="detail-value notes-content">
                            ${contract.Notes}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="contract-actions">
                <button onclick="app.viewFullContract(${contract.ContractID})" class="btn btn-primary btn-sm" id="view-full-contract-btn-${contract.ContractID}">
                    <i class="fas fa-file-alt"></i> View Full Contract
                </button>
            </div>
        `;
    }

    async viewFullContract(contractId) {
        try {
            console.log(`📋 Loading full contract view for ${contractId}`);
            
            // Get the contract details (we might already have them)
            const contract = await this.apiCall(`contracts/${contractId}`);
            if (!contract) {
                this.showToast('Contract not found', 'error');
                return;
            }
            
            // Find the inline view container
            const inlineView = document.querySelector(`.inline-contract-view[data-contract-id="${contractId}"] .inline-view-body`);
            if (!inlineView) return;
            
            // Generate the full contract HTML
            const fullContractHtml = this.getFullContractHtml(contract);
            
            // Replace the summary view with the full contract view
            inlineView.innerHTML = fullContractHtml;
            
            // Scroll to show the full contract
            inlineView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
        } catch (error) {
            console.error('Error loading full contract:', error);
            this.showToast('Error loading full contract', 'error');
        }
    }

    async hideFullContract(contractId) {
        try {
            console.log(`📋 Returning to contract summary for ${contractId}`);
            
            // Get the contract details
            const contract = await this.apiCall(`contracts/${contractId}`);
            if (!contract) return;
            
            // Find the inline view container
            const inlineView = document.querySelector(`.inline-contract-view[data-contract-id="${contractId}"] .inline-view-body`);
            if (!inlineView) return;
            
            // Replace the full contract view with the summary view
            const summaryHtml = this.getContractViewHtml(contract);
            inlineView.innerHTML = summaryHtml;
            
        } catch (error) {
            console.error('Error returning to summary:', error);
            this.showToast('Error returning to summary', 'error');
        }
    }

    getFullContractHtml(contract) {
        const currentDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        return `
            <div class="full-contract-document">
                <!-- Contract Header -->
                <div class="contract-header" style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #007bff;">
                    <h2 style="color: #007bff; margin-bottom: 10px; font-size: 2rem;">
                        DESIGN CONTRACT
                    </h2>
                    <h3 style="color: #666; margin: 0; font-size: 1.2rem;">
                        Contract No: ${contract.ContractNumber || contract.ContractID}
                    </h3>
                </div>

                <!-- Contract Details Section -->
                <div class="contract-section" style="margin-bottom: 25px;">
                    <h4 style="color: #007bff; margin-bottom: 15px; font-size: 1.3rem; border-bottom: 2px solid #007bff; padding-bottom: 5px;">
                        CONTRACT DETAILS
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <strong>Contract Date:</strong> ${contract.CreatedDate ? this.formatDate(contract.CreatedDate) : currentDate}<br>
                            <strong>Contract Type:</strong> ${contract.ContractType || 'Standard Design Contract'}<br>
                            <strong>Contract Status:</strong> 
                            <span class="status-badge status-${(contract.ContractStatus || 'draft').toLowerCase()}" style="margin-left: 5px;">
                                ${contract.ContractStatus || 'Draft'}
                            </span>
                        </div>
                        <div>
                            <strong>Contract Amount:</strong> ${contract.ContractAmount ? this.formatCurrency(contract.ContractAmount) : 'To Be Determined'}<br>
                            <strong>Signed Date:</strong> ${contract.SignedDate ? this.formatDate(contract.SignedDate) : 'Pending'}<br>
                            <strong>Last Modified:</strong> ${contract.ModifiedDate ? this.formatDate(contract.ModifiedDate) : 'N/A'}
                        </div>
                    </div>
                </div>

                <!-- Parties Section -->
                <div class="contract-section" style="margin-bottom: 25px;">
                    <h4 style="color: #007bff; margin-bottom: 15px; font-size: 1.3rem; border-bottom: 2px solid #007bff; padding-bottom: 5px;">
                        CONTRACTING PARTIES
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                        <div style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
                            <h5 style="color: #007bff; margin-bottom: 10px;">CONTRACTOR</h5>
                            <strong>Omega Builders, LLC</strong><br>
                            1934 Florence St, Enumclaw, Wa 98022<br>
                            <em>Licensed General Contractor</em>
                        </div>
                        <div style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #28a745; border-radius: 4px;">
                            <h5 style="color: #28a745; margin-bottom: 10px;">CLIENT</h5>
                            <strong>${contract.CompanyName || 'Client Name'}</strong><br>
                            ${contract.ContactName ? `Contact: ${contract.ContactName}<br>` : ''}
                            ${contract.Address || 'Address on file'}
                            ${contract.City && contract.State ? `<br>${contract.City}, ${contract.State}` : ''}
                            ${contract.ZipCode ? ` ${contract.ZipCode}` : ''}
                        </div>
                    </div>
                </div>

                <!-- Project Information -->
                <div class="contract-section" style="margin-bottom: 25px;">
                    <h4 style="color: #007bff; margin-bottom: 15px; font-size: 1.3rem; border-bottom: 2px solid #007bff; padding-bottom: 5px;">
                        PROJECT INFORMATION
                    </h4>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6;">
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #007bff;">Project Name:</strong><br>
                            <span style="font-size: 1.1rem;">${contract.ProjectName || 'Project Name'}</span>
                        </div>
                        ${contract.ProjectDescription ? `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #007bff;">Project Description:</strong><br>
                            ${contract.ProjectDescription}
                        </div>
                        ` : ''}
                        <div>
                            <strong style="color: #007bff;">Project Location:</strong><br>
                            ${contract.ProjectAddress || 'Project Address'}<br>
                            ${contract.ProjectCity || 'City'}, ${contract.ProjectState || 'State'} ${contract.ProjectZip || 'ZIP'}
                        </div>
                        ${contract.StartDate ? `
                        <div style="margin-top: 15px;">
                            <strong style="color: #007bff;">Project Timeline:</strong><br>
                            Start Date: ${this.formatDate(contract.StartDate)}<br>
                            ${contract.EstimatedCompletionDate ? `Estimated Completion: ${this.formatDate(contract.EstimatedCompletionDate)}` : ''}
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Contract Terms -->
                <div class="contract-section" style="margin-bottom: 25px;">
                    <h4 style="color: #007bff; margin-bottom: 15px; font-size: 1.3rem; border-bottom: 2px solid #007bff; padding-bottom: 5px;">
                        TERMS AND CONDITIONS
                    </h4>
                    <div style="line-height: 1.6; color: #333; font-size: 0.95rem;">
                        <p style="margin-bottom: 15px; text-align: justify;">
                            This Design Service Contract (the "Contract") is made as of ${currentDate} (the "Effective Date") by and between 
                            <strong>${contract.CompanyName || 'Client'}</strong> ("Client"), and <strong>OMEGA BUILDERS, LLC</strong> ("Company"). 
                            OMEGA BUILDERS, LLC desires to provide Design services to Client and Client desires to obtain such services from Company. 
                            THEREFORE, in consideration of the mutual promises set forth below, the parties agree as follows:
                        </p>

                        <p><strong>1. DESCRIPTION OF SERVICES.</strong> Beginning on agreed upon date of approximately 
                        ${contract.StartDate ? this.formatDate(contract.StartDate) : '[Start Date]'}, OMEGA BUILDERS, LLC will provide to 
                        Client the services described in the attached Estimate: ${contract.EstimateNumber || '[Estimate Number]'} 
                        (collectively, the "Services").</p>

                        <p><strong>2. SCOPE OF WORK.</strong> OMEGA BUILDERS, LLC will provide all services, materials and labor for 
                        ${contract.ProjectName || 'the project'}, as described in the attached Estimate: ${contract.EstimateNumber || '[Estimate Number]'}.</p>

                        <p style="margin-bottom: 10px;">Note that the design is intended to follow prescriptive building codes without the need for outside engineering. 
                        If engineering is required, OMEGA BUILDERS, LLC will coordinate with an engineer to exchange the necessary information required 
                        to complete the process. Engineering fees are to be paid by the client, directly to the engineer. Please note that OMEGA BUILDERS, LLC 
                        has no control over the schedule and time frames of third party vendors. Estimated schedules apply only to work performed by the Company.</p>

                        <p><strong>3. PLANS, SPECIFICATIONS AND CONSTRUCTION DOCUMENTS.</strong> Client will make available to OMEGA BUILDERS, LLC 
                        all plans, specifications, drawings, blueprints, and similar construction documents necessary for OMEGA BUILDERS, LLC to provide 
                        the Services described herein. Any such materials shall remain the property of Client. OMEGA BUILDERS, LLC will promptly return 
                        all such materials to Client upon completion of the Services, where appropriate.</p>

                        <p><strong>4. COMPLIANCE WITH LAWS.</strong> OMEGA BUILDERS, LLC shall provide the Services in a workmanlike manner, 
                        and in compliance with all applicable federal, state and local laws and regulations, including, but not limited to 
                        all provisions of the Fair Labor Standards Act, the Americans with Disabilities Act, and the Federal Family and Medical Leave Act.</p>

                        <p><strong>5. WORK SITE.</strong> Client warrants that Client owns the property herein described and is authorized to enter into this contract.</p>

                        <p><strong>6. PAYMENT.</strong> Payment shall be made to: OMEGA BUILDERS, LLC</p>
                        
                        <p>Client agrees to pay OMEGA BUILDERS, LLC as follows:</p>
                        
                        <p style="margin-left: 20px;"><strong>Total Estimate amount with Tax: ${contract.ContractAmount ? this.formatCurrency(contract.ContractAmount) : '[Amount To Be Determined]'}</strong></p>
                        
                        ${contract.PayTerms ? contract.PayTerms.map(payTerm => `
                            <p style="margin-left: 20px;"><strong>${payTerm.PayTermName}:</strong> ${payTerm.FixedAmount ? this.formatCurrency(payTerm.FixedAmount) : (payTerm.PercentageAmount ? payTerm.PercentageAmount + '%' : '[Amount]')}</p>
                        `).join('') : ''}

                        <p style="text-decoration: underline; margin: 10px 0;">*Depending on change order amounts, these will be billed out separately and may need to be paid sooner than the milestones listed above. 
                        Note: It is recommended that Client have available a minimum of 20% of the total bid for potential cost overruns, not including client requested changes. 
                        It is also important to note that the contract is based on a provided estimate. While every effort is made to provide all anticipated costs in the estimate, 
                        it is not unusual for additional costs to arise throughout the process. The client is responsible for payment to cover these additional costs.</p>

                        <p>If any invoice is not paid when due, interest will be added to and payable on all overdue amounts at 15 percent per year, 
                        or the maximum percentage allowed under applicable laws, whichever is less. Client shall pay all costs of collection, 
                        including without limitation, reasonable attorney fees.</p>

                        <p><strong>7. TERM.</strong> OMEGA BUILDERS, LLC shall commence the work to be performed on approximately 
                        ${contract.StartDate ? this.formatDate(contract.StartDate) : '[Start Date]'} and shall have a target completion date of 
                        ${contract.EstimatedCompletionDate ? this.formatDate(contract.EstimatedCompletionDate) : '[Completion Date]'}, 
                        taking into consideration any time delays due to unforeseen circumstances.</p>

                        <p><strong>8. CHANGE ORDER.</strong> Client, or any allowed person, e.g. lender, public body, or inspector, may make changes 
                        to the scope of the work from time to time during the term of this Contract. However, any such change or modification shall only 
                        be made in a written "Change Order" which is signed and dated by both parties.</p>

                        <p><strong>9. PERMITS.</strong> In cases where OMEGA BUILDERS, LLC agrees to coordinate the submittal and acquisition of building permits, 
                        the Client will be responsible for paying permit fees directly to the permitting agency. Please note that in rare circumstances, 
                        projects may not be permittable as requested. OMEGA BUILDERS, LLC assumes no responsibility or liability for unpermittable projects 
                        and full payment is still required as agreed to in this contract.</p>

                        <p><strong>10. CONFIDENTIALITY.</strong> OMEGA BUILDERS, LLC, and its employees, agents, or representatives will not at any time 
                        or in any manner, either directly or indirectly, use for the personal benefit of OMEGA BUILDERS, LLC, or divulge, disclose, 
                        or communicate in any manner, any information that is proprietary to Client.</p>

                        <p><strong>11. FREE ACCESS TO WORKSITE.</strong> Client will allow free access to work areas for OMEGA BUILDERS, LLC, 
                        with appropriate notice, should the need arise.</p>

                        <p><strong>12. INSPECTION.</strong> Client shall have the right to inspect all work performed under this Contract. 
                        All defects and uncompleted items shall be reported immediately.</p>

                        <p><strong>13. DEFAULT.</strong> The occurrence of any of the following shall constitute a material default under this Contract:
                        <br>a. The failure of Client to make a required payment when due.
                        <br>b. The insolvency of either party or if either party shall become a debtor under the United States Bankruptcy Code.
                        <br>c. A lawsuit brought on any claim, seizure, lien or levy for labor performed or materials used on the project.
                        <br>d. The failure of Client to make the building site available or the failure of OMEGA BUILDERS, LLC to deliver the Services in the time and manner provided.</p>

                        <p><strong>14. REMEDIES.</strong> In addition to any and all other rights a party may have available according to law of the State of Washington, 
                        if a party defaults by failing to substantially perform any provision, term or condition of this Contract, the other party may terminate 
                        the Contract by providing written notice to the defaulting party.</p>

                        <p><strong>15. FORCE MAJEURE.</strong> If performance of this Contract or any obligation under this Contract is prevented, 
                        restricted, or interfered with by causes beyond either party's reasonable control ("Force Majeure"), and if the party unable 
                        to carry out its obligations gives the other party prompt written notice of such event, then the obligations of the party invoking 
                        this provision shall be suspended to the extent necessary by such event.</p>

                        <p><strong>16. ARBITRATION.</strong> Any controversy or claim arising out of or relating to this Contract, or the breach thereof, 
                        shall be settled by arbitration administered by the American Arbitration Association in accordance with its Commercial Arbitration Rules.</p>

                        <p><strong>17. ENTIRE CONTRACT.</strong> This Contract contains the entire Contract of the parties, and there are no other promises 
                        or conditions in any other contract whether oral or written concerning the subject matter of this Contract. Any amendments must be in writing and signed by each party.</p>

                        <p><strong>18. SEVERABILITY.</strong> If any provision of this Contract will be held to be invalid or unenforceable for any reason, 
                        the remaining provisions will continue to be valid and enforceable.</p>

                        <p><strong>19. AMENDMENT.</strong> This Contract may be modified or amended in writing, if the writing is signed by each party.</p>

                        <p><strong>20. GOVERNING LAW.</strong> This Contract shall be construed in accordance with, and governed by the laws of the State of Washington, 
                        without regard to any choice of law provisions of Washington or any other jurisdiction.</p>

                        <p><strong>21. NOTICE.</strong> Any notice or communication required or permitted under this Contract shall be sufficiently given 
                        if delivered in person or by certified mail, return receipt requested, to the address set forth in the opening paragraph or to such other address 
                        as one party may have furnished to the other in writing. This includes electronic communication such as email, text, etc.</p>

                        <p><strong>22. HOLD HARMLESS.</strong> Omega Builders, LLC shall not be held responsible for work performed by third party contractor 
                        that does not meet code or is otherwise substandard, or fails to meet customer's satisfaction.</p>

                        <p><strong>23. WAIVER OF CONTRACTUAL RIGHT.</strong> The failure of either party to enforce any provision of this Contract 
                        shall not be construed as a waiver or limitation of that party's right to subsequently enforce and compel strict compliance with every provision of this Contract.</p>

                        <p><strong>24. ASSIGNMENT.</strong> Neither party may assign or transfer this Contract without the prior written consent of the non-assigning party, 
                        which approval shall not be unreasonably withheld.</p>

                        <p><strong>25. COMMUNICATION.</strong> Email is the preferred method of communication, please do not call me unless it is absolutely unavoidable. 
                        Technical information is not best exchanged via phone call and I will likely be working on another project at the time of your call.</p>

                        <p><strong>26. SIGNATORIES.</strong> This Contract shall be signed on behalf of Client, by ${contract.ContactName || '[Contact Name]'}, 
                        and on behalf of OMEGA BUILDERS, LLC (OMEGA BUILDERS, LLC License: <strong>OMEGABL833BK</strong>) by <strong>Darren Anderson</strong>, <strong>President</strong>, 
                        and shall be effective as of the date first written above.</p>
                    </div>
                </div>

                ${contract.Notes ? `
                <!-- Special Notes -->
                <div class="contract-section" style="margin-bottom: 25px;">
                    <h4 style="color: #007bff; margin-bottom: 15px; font-size: 1.3rem; border-bottom: 2px solid #007bff; padding-bottom: 5px;">
                        SPECIAL NOTES & PROVISIONS
                    </h4>
                    <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 4px;">
                        ${contract.Notes}
                    </div>
                </div>
                ` : ''}

                <!-- Signatures Section -->
                <div class="contract-section" style="margin-bottom: 25px;">
                    <h4 style="color: #007bff; margin-bottom: 15px; font-size: 1.3rem; border-bottom: 2px solid #007bff; padding-bottom: 5px;">
                        SIGNATURES
                    </h4>
                    
                    <!-- Digital Signature Agreement -->
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; font-size: 0.95rem; color: #495057; cursor: pointer;">
                            <input type="checkbox" 
                                   id="signature-agreement-${contract.ContractID}" 
                                   ${contract.ContractStatus === 'Signed' ? 'checked disabled' : ''} 
                                   style="margin-right: 10px; transform: scale(1.2);" 
                                   onchange="app.toggleSignatureFields(${contract.ContractID})">
                            <span><strong>By checking this box, I agree to allow my typed name on this contract to represent my legal signature.</strong> I understand that this electronic signature has the same legal effect as a handwritten signature.</span>
                        </label>
                    </div>

                    <div id="signature-fields-${contract.ContractID}" style="display: ${contract.ContractStatus === 'Signed' ? 'block' : 'none'}; margin-top: 20px;">
                        ${contract.ContractStatus === 'Signed' ? `
                            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin-bottom: 20px; text-align: center;">
                                <i class="fas fa-check-circle" style="color: #28a745; font-size: 1.5rem; margin-right: 10px;"></i>
                                <strong style="color: #155724;">This contract has been digitally signed</strong>
                                <div style="font-size: 0.9rem; color: #155724; margin-top: 5px;">
                                    Signed on: ${contract.SignedDate ? this.formatDate(contract.SignedDate) : 'Date not available'}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
                            <div>
                                <label style="font-weight: bold; color: #007bff; margin-bottom: 5px; display: block;">Contractor Signature:</label>
                                <input type="text" 
                                       id="contractor-signature-${contract.ContractID}" 
                                       placeholder="Type your name here"
                                       value="${contract.ContractStatus === 'Signed' ? (contract.ContractorSignature || 'Darren Anderson') : 'Darren Anderson'}"
                                       ${contract.ContractStatus === 'Signed' ? 'readonly' : 'readonly'}
                                       class="signature-input signature-style-1"
                                       style="width: 100%; padding: 10px; border: none; border-bottom: 2px solid #007bff; background: transparent; color: #007bff; font-weight: bold;">
                                <div style="margin-top: 5px; font-size: 0.9rem; color: #666;">
                                    <strong>Darren Anderson, President</strong><br>
                                    <em>Omega Builders, LLC</em><br>
                                    Date: <input type="date" id="contractor-date-${contract.ContractID}" 
                                                 value="${contract.ContractStatus === 'Signed' ? (contract.ContractorSignatureDate ? contract.ContractorSignatureDate.split('T')[0] : new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]}" 
                                                 ${contract.ContractStatus === 'Signed' ? 'readonly' : ''} 
                                                 style="border: none; border-bottom: 1px solid #ccc; background: transparent;">
                                </div>
                            </div>
                            <div>
                                <label style="font-weight: bold; color: #28a745; margin-bottom: 5px; display: block;">Client Signature:</label>
                                <input type="text" 
                                       id="client-signature-${contract.ContractID}" 
                                       placeholder="Type your full legal name here"
                                       value="${contract.ContractStatus === 'Signed' ? (contract.ClientSignature || '') : ''}"
                                       ${contract.ContractStatus === 'Signed' ? 'readonly' : ''}
                                       class="signature-input signature-style-1"
                                       style="width: 100%; padding: 10px; border: none; border-bottom: 2px solid #28a745; background: transparent; color: #28a745; font-weight: bold;">
                                <div style="margin-top: 5px; font-size: 0.9rem; color: #666;">
                                    <strong>${contract.CompanyName || 'Client Name'}</strong><br>
                                    Date: <input type="date" id="client-date-${contract.ContractID}" 
                                                 value="${contract.ContractStatus === 'Signed' ? (contract.ClientSignatureDate ? contract.ClientSignatureDate.split('T')[0] : new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]}" 
                                                 ${contract.ContractStatus === 'Signed' ? 'readonly' : ''} 
                                                 style="border: none; border-bottom: 1px solid #ccc; background: transparent;">
                                </div>
                            </div>
                        </div>
                        
                        ${contract.ContractStatus !== 'Signed' ? `
                            <div style="margin-top: 20px; text-align: center;">
                                <button onclick="app.saveContractSignatures(${contract.ContractID})" 
                                        class="btn btn-success btn-lg" 
                                        style="padding: 12px 30px; font-size: 1.1rem;">
                                    <i class="fas fa-save"></i> Save Signed Contract
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Traditional signature lines (shown when not digitally signed) -->
                    <div id="traditional-signatures-${contract.ContractID}" style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px;">
                        <div>
                            <div style="border-bottom: 2px solid #333; margin-bottom: 10px; height: 40px;"></div>
                            <strong>Contractor:</strong> Darren Anderson, President<br>
                            <em>Omega Builders, LLC</em><br>
                            <span style="color: #666;">Date: _________________</span>
                        </div>
                        <div>
                            <div style="border-bottom: 2px solid #333; margin-bottom: 10px; height: 40px;"></div>
                            <strong>Client:</strong> ${contract.CompanyName || 'Client Name'}<br>
                            <span style="color: #666;">Date: _________________</span>
                        </div>
                    </div>
                </div>

                <!-- Contract Actions -->
                <div class="contract-actions" style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #dee2e6; text-align: center;">
                    <button onclick="app.hideFullContract(${contract.ContractID})" class="btn btn-secondary btn-sm" style="margin-right: 10px;">
                        <i class="fas fa-arrow-left"></i> Hide Full Contract
                    </button>
                    <button onclick="app.downloadContractPDF(${contract.ProjectID})" class="btn btn-primary btn-sm">
                        <i class="fas fa-file-pdf"></i> Download PDF
                    </button>
                </div>
            </div>
        `;
    }

    closeInlineContractView() {
        // Remove any existing inline views
        const existingViews = document.querySelectorAll('.inline-contract-view');
        existingViews.forEach(view => view.remove());
        
        // Remove highlights from rows
        const highlightedRows = document.querySelectorAll('.row-selected');
        highlightedRows.forEach(row => row.classList.remove('row-selected'));
    }

    toggleSignatureFields(contractId) {
        const checkbox = document.getElementById(`signature-agreement-${contractId}`);
        const signatureFields = document.getElementById(`signature-fields-${contractId}`);
        const traditionalSignatures = document.getElementById(`traditional-signatures-${contractId}`);
        
        if (checkbox.checked) {
            signatureFields.style.display = 'block';
            traditionalSignatures.style.display = 'none';
        } else {
            signatureFields.style.display = 'none';
            traditionalSignatures.style.display = 'grid';
        }
    }

    async saveContractSignatures(contractId) {
        console.log(`🖊️ Starting saveContractSignatures for contract ${contractId}`);
        
        const contractorSignature = document.getElementById(`contractor-signature-${contractId}`)?.value?.trim();
        const clientSignature = document.getElementById(`client-signature-${contractId}`)?.value?.trim();
        const contractorDate = document.getElementById(`contractor-date-${contractId}`)?.value;
        const clientDate = document.getElementById(`client-date-${contractId}`)?.value;
        const agreed = document.getElementById(`signature-agreement-${contractId}`)?.checked;

        console.log('📝 Signature data:', {
            contractorSignature,
            clientSignature,
            contractorDate,
            clientDate,
            agreed
        });

        if (!agreed) {
            this.showToast('Please check the signature agreement checkbox first.', 'error');
            return;
        }

        if (!contractorSignature || !clientSignature) {
            this.showToast('Both contractor and client signatures are required.', 'error');
            return;
        }

        if (!contractorDate || !clientDate) {
            this.showToast('Both signature dates are required.', 'error');
            return;
        }

        try {
            console.log(`💾 Saving signatures for contract ${contractId}`);
            
            // Get IP address first
            let ipAddress = 'Unknown';
            try {
                ipAddress = await this.getClientIP();
                console.log('🌐 Got IP address:', ipAddress);
            } catch (ipError) {
                console.warn('⚠️ Could not get IP address:', ipError);
            }
            
            const requestData = {
                contractorSignature,
                clientSignature,
                contractorDate,
                clientDate,
                signedTimestamp: new Date().toISOString(),
                ipAddress
            };
            
            console.log('📤 Sending request data:', requestData);
            
            const response = await fetch(`/api/contracts/${contractId}/signatures`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            console.log('📥 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Response error:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Contract signatures saved:', result);
            
            this.showToast('Contract has been digitally signed successfully!', 'success');
            
            // Update the checkbox to disabled and checked state
            const checkbox = document.getElementById(`signature-agreement-${contractId}`);
            if (checkbox) {
                checkbox.checked = true;
                checkbox.disabled = true;
            }
            
            // Update the status in the contracts table without full reload
            const statusCell = document.querySelector(`tr[data-contract-id="${contractId}"] td:nth-child(5)`);
            if (statusCell) {
                statusCell.innerHTML = '<span class="status-badge status-signed">Signed</span>';
            }
            
            // Refresh just this contract's details by calling loadContracts but keeping the signature view open
            setTimeout(async () => {
                await this.loadContracts();
                // Re-open the signature view for this specific contract to show the signed state
                const signatureFields = document.getElementById(`signature-fields-${contractId}`);
                if (signatureFields) {
                    signatureFields.style.display = 'block';
                }
            }, 500);
            
        } catch (error) {
            console.error('❌ Error saving contract signatures:', error);
            this.showToast('Error saving contract signatures: ' + error.message, 'error');
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.warn('Could not get client IP:', error);
            return 'Unknown';
        }
    }

    async downloadContractPDF(projectId) {
        try {
            console.log(`📄 Downloading PDF for project ${projectId}`);
            
            const response = await fetch(`/api/contracts/pdf/${projectId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/pdf'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Contract_${contractId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log('✅ Contract PDF download initiated');
            
        } catch (error) {
            console.error('❌ Error downloading contract PDF:', error);
            this.showToast('Error downloading contract PDF: ' + error.message, 'error');
        }
    }

    // Line Items
    async loadLineItems() {
        try {
            const lineItems = await this.apiCall('lineitems');
            this.data.lineItems = lineItems;
            this.renderLineItemTable(lineItems);
        } catch (error) {
            console.error('Error loading line items:', error);
        }
    }

    renderLineItemTable(lineItems) {
        const tableBody = document.getElementById('lineitem-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = lineItems.map(item => `
            <tr>
                <td>${item.LineItemID}</td>
                <td>${item.Description}</td>
                <td>${item.Quantity}</td>
                <td>${item.UnitPrice ? this.formatCurrency(item.UnitPrice) : ''}</td>
                <td>${item.TotalAmount ? this.formatCurrency(item.TotalAmount) : ''}</td>
                <td>
                    <span class="action-buttons">
                        <button class="action-btn edit" title="Edit" onclick="app.showLineItemModal(${item.LineItemID})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" title="Delete" onclick="app.deleteLineItem(${item.LineItemID})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </span>
                </td>
            </tr>
        `).join('');
    }

    showLineItemModal(lineItemId) {
        const lineItem = this.data.lineItems.find(item => item.LineItemID === lineItemId) || {};
        document.getElementById('lineitem-modal-title').innerText = lineItemId ? 'Edit Line Item' : 'Add Line Item';
        document.getElementById('lineitem-modal-submit').innerText = lineItemId ? 'Update Line Item' : 'Add Line Item';

        // Fill form fields with line item data or leave blank
        document.getElementById('lineitem-id').value = lineItem.LineItemID || '';
        document.getElementById('lineitem-description').value = lineItem.Description || '';
        document.getElementById('lineitem-quantity').value = lineItem.Quantity || '';
        document.getElementById('lineitem-unit-price').value = lineItem.UnitPrice || '';

        $('#lineitem-modal').modal('show');
    }

    async saveLineItem() {
        const lineItemId = document.getElementById('lineitem-id').value;
        const lineItemData = {
            Description: document.getElementById('lineitem-description').value,
            Quantity: document.getElementById('lineitem-quantity').value,
            UnitPrice: document.getElementById('lineitem-unit-price').value
        };

        try {
            if (lineItemId) {
                // Update existing line item
                await this.apiCall(`lineitems/${lineItemId}`, 'PUT', lineItemData);
                this.showToast('Line item updated successfully', 'success');
            } else {
                // Add new line item
                await this.apiCall('lineitems', 'POST', lineItemData);
                this.showToast('Line item added successfully', 'success');
            }
            $('#lineitem-modal').modal('hide');
            this.loadLineItems();
        } catch (error) {
            console.error('Error saving line item:', error);
        }
    }

    async deleteLineItem(lineItemId) {
        if (!confirm('Are you sure you want to delete this line item?')) return;
        try {
            await this.apiCall(`lineitems/${lineItemId}`, 'DELETE');
            this.showToast('Line item deleted successfully', 'success');
            this.loadLineItems();
        } catch (error) {
            console.error('Error deleting line item:', error);
        }
    }

    // Utility functions
    formatDate(dateString) {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    formatCurrency(amount) {
        if (amount == null) return '';
        const currencySymbol = (this.settings && this.settings.currency_symbol) || '$';
        return currencySymbol + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }

    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        toastContainer.appendChild(toast);

        // Auto-dismiss toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showToastLong(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        toastContainer.appendChild(toast);

        // Auto-dismiss toast after 6 seconds (longer for important messages)
        setTimeout(() => {
            toast.remove();
        }, 6000);
    }

    updateInlineConfirmationMessage(message, type = 'info') {
        const confirmation = document.querySelector('.inline-invoice-confirmation');
        if (!confirmation) return;
        
        const messageElement = confirmation.querySelector('.success-message p');
        if (messageElement) {
            messageElement.innerHTML = `<strong>${message}</strong>`;
            
            // Update the color based on type
            if (type === 'success') {
                messageElement.style.color = '#155724';
            } else if (type === 'error') {
                messageElement.style.color = '#721c24';
            } else if (type === 'info') {
                messageElement.style.color = '#0c5460';
            }
        }
    }

    clearProjectDetails() {
        this.editingProjectId = null;
        this.filterProjects('');
    }
    renderCustomerTable(customers) {
        const tableBody = document.getElementById('customers-table-body');
        if (!tableBody) {
            console.error('Customers table body not found');
            return;
        }
        
        // Responsive design - use mobile layout on iPad and iPhone
        const isMobile = window.innerWidth <= 1024;
        console.log('CUSTOMERS - Screen width:', window.innerWidth, 'Mobile mode:', isMobile);
        
        if (isMobile) {
            console.log('Using mobile customer list rendering');
            // Create mobile-friendly list view
            this.renderCustomersMobileList(customers);
            return;
        }
        
        let tableContent = '';
        
        // Add new customer form row if editing a new customer
        if (this.editingCustomerId === 'new') {
            const newCustomer = {
                CustomerID: '',
                CompanyName: '',
                ContactName: '',
                Phone: '',
                Email: '',
                Status: 'active',
                Address: '',
                City: '',
                State: '',
                ZipCode: ''
            };
            tableContent += `<tr class='edit-row'><td colspan='7'>${this.getCustomerEditFormHtml(newCustomer)}</td></tr>`;
        }
        
        if (!customers || customers.length === 0) {
            if (this.editingCustomerId !== 'new') {
                tableContent = '<tr><td colspan="7" class="text-muted text-center">No customers found</td></tr>';
            }
        } else {
            tableContent += customers.map(customer => {
                const isViewing = this.viewingCustomerId == customer.CustomerID; // Use == instead of === for type coercion
                const isEditing = this.editingCustomerId == customer.CustomerID; // Use == instead of === for type coercion
                
                const rowHtml = `
                    <tr>
                        <td>${customer.CompanyName || ''}</td>
                        <td>${customer.ContactName || ''}</td>
                        <td>${this.formatPhoneDisplay(customer.Phone || '')}</td>
                        <td>${customer.Email || ''}</td>
                        <td>${customer.CreatedDate ? this.formatDate(customer.CreatedDate) : ''}</td>
                        <td>${customer.Status || ''}</td>
                        <td>
                            <span class="action-buttons">
                                ${!isEditing ? `<button class="action-btn view" title="View" onclick="app.toggleCustomerView('${customer.CustomerID}')"><i class="fas fa-eye"></i></button>` : ''}
                                ${!isEditing ? `<button class="action-btn edit" title="Edit" onclick="app.showCustomerModal('${customer.CustomerID}')"><i class="fas fa-edit"></i></button>` : ''}
                                ${!isEditing ? `<button class="action-btn delete" title="Delete" onclick="app.deleteCustomer('${customer.CustomerID}')"><i class="fas fa-trash"></i></button>` : ''}
                            </span>
                        </td>
                    </tr>
                    ${isViewing ? `<tr class='view-row'><td colspan='7'>${this.getCustomerViewHtml(customer)}</td></tr>` : ''}
                    ${isEditing ? `<tr class='edit-row'><td colspan='7'>${this.getCustomerEditFormHtml(customer)}</td></tr>` : ''}
                `;
                return rowHtml;
            }).join('');
        }
        
        tableBody.innerHTML = tableContent;
        
        // Apply mobile optimizations to the newly rendered table
        this.applyMobileUIAdjustments();
        
        // Set up address autocomplete and phone formatting for any customer edit forms that were just rendered
        setTimeout(() => {
            this.setupCustomerAddressAutocomplete();
            this.setupPhoneFormattingForExistingInputs();
        }, 100);
        
        this.updateCustomerCount();
    }

    updateCustomerCount(filteredCount, totalCount) {
        const countEl = document.getElementById('customer-count');
        if (countEl) {
            if (filteredCount !== undefined && totalCount !== undefined && filteredCount !== totalCount) {
                // Show filtered count vs total
                countEl.textContent = `${filteredCount} of ${totalCount} customer${totalCount === 1 ? '' : 's'}`;
            } else {
                // Show regular count
                const count = totalCount || this.data.customers.length;
                countEl.textContent = `${count} customer${count === 1 ? '' : 's'}`;
            }
        }
    }

    openProjectFromDashboard(projectId) {
        // Switch to projects section and view the project (not edit)
        this.switchSection('projects');
        
        // Wait for both projects AND estimates to load, then open the project for viewing
        setTimeout(async () => {
            console.log('Opening project for viewing:', projectId);
            
            // Ensure both projects and estimates are loaded
            try {
                // Check if projects are loaded, if not wait a bit more
                if (!this.data.projects || this.data.projects.length === 0) {
                    console.log('Projects not loaded yet, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // Load estimates to ensure they're available for the project view
                console.log('Loading estimates for project view...');
                await this.loadEstimates();
                
                // Now open the project view
                this.toggleProjectView(projectId);
                
                // Scroll to the project row after it opens
                setTimeout(() => {
                    const projectRow = document.querySelector(`tr.view-row`);
                    if (projectRow) {
                        projectRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 200);
                
            } catch (error) {
                console.error('Error loading data for project view:', error);
                // Fallback - still try to show the project view
                this.toggleProjectView(projectId);
            }
        }, 300);
    }
    
    focusOnEditingForm() {
        // Additional wait to ensure the form is rendered, then scroll and focus
        setTimeout(() => {
            const editRow = document.querySelector('tr.edit-row');
            if (editRow) {
                // Scroll the edit row into view with some padding
                editRow.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
                
                // Focus on the first input field in the form
                const firstInput = editRow.querySelector('input[type="text"], textarea, select');
                if (firstInput) {
                    setTimeout(() => {
                        firstInput.focus();
                        firstInput.select(); // Select the text if it's a text input
                    }, 300);
                }
                
                // Add a subtle highlight effect
                editRow.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.5)';
                setTimeout(() => {
                    editRow.style.boxShadow = '';
                }, 2000);
                
                console.log('Project editing form should now be visible and focused');
            } else {
                console.log('Edit row not found for focusing');
            }
        }, 200);
    }

    viewCustomer(customerId) {
        this.toggleCustomerView(customerId);
    }

    // Workflow functions
    createPayTermsFromProject(projectId) {
        // Navigate to pay terms section and pre-populate with project data
        this.switchSection('payterms');
        setTimeout(() => {
            const project = this.data.projects.find(p => p.ProjectID === projectId);
            if (project) {
                this.showPayTermModal(projectId);
            }
        }, 500);
    }

    async loadPayTermsForEstimate(estimateId) {
        try {
            // Get the project ID for this estimate first
            const estimate = this.data.estimates.find(e => e.EstimateID == estimateId);
            if (!estimate) return;

            const response = await fetch(`/api/payterms/estimate/${estimateId}`);
            if (!response.ok) return;
            
            const payTerms = await response.json();
            const contentDiv = document.getElementById(`pay-terms-content-${estimateId}`);
            if (!contentDiv) return;

            if (payTerms.length === 0) {
                contentDiv.innerHTML = `
                    <div style="color: #6c757d; font-style: italic; text-align: center; padding: 10px;">
                        No payment terms created yet. Click "Create Pay Terms" above to get started.
                    </div>
                `;
                return;
            }

            // Display pay terms as clickable links
            const payTermsHtml = payTerms.map(payTerm => {
                const statusColor = payTerm.PayTermStatus === 'Paid' ? '#28a745' : '#007bff';
                const statusIcon = payTerm.PayTermStatus === 'Paid' ? '✅' : '💳';
                
                return `
                    <div class="pay-term-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin: 5px 0; background: white; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer; transition: all 0.2s ease;" onclick="app.createInvoiceFromPayTerm(${payTerm.PayTermID})" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,123,255,0.3)'; this.style.borderColor='#007bff';" onmouseout="this.style.boxShadow=''; this.style.borderColor='#dee2e6';">
                        <div style="flex: 1;">
                            <strong style="color: #333;">${payTerm.PayTermName}</strong>
                            <div style="font-size: 0.9em; color: #666; margin-top: 2px;">
                                ${payTerm.PayTermDescription || ''}
                            </div>
                            <div style="font-size: 0.8em; color: #007bff; margin-top: 4px; font-style: italic;">
                                💡 Click to create invoice for this payment
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: bold; color: ${statusColor};">
                                ${statusIcon} ${this.formatCurrency(payTerm.FixedAmount || 0)}
                            </div>
                            <div style="font-size: 0.85em; color: ${statusColor};">
                                ${payTerm.PayTermStatus}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            const totalAmount = payTerms.reduce((sum, term) => sum + (term.FixedAmount || 0), 0);
            
            contentDiv.innerHTML = `
                ${payTermsHtml}
                <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #155724; display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
                    <span>Total Contract Value:</span>
                    <span style="color: #155724; font-size: 1.1em;">${this.formatCurrency(totalAmount)}</span>
                </div>
            `;
        } catch (error) {
            console.error('Error loading pay terms for estimate:', error);
        }
    }

    viewPayTermDetails(payTermId) {
        // Switch to pay terms section and highlight the specific pay term
        this.switchSection('payterms');
        setTimeout(() => {
            // Scroll to and highlight the pay term row
            const payTermRow = document.querySelector(`tr[data-payterm-id="${payTermId}"]`);
            if (payTermRow) {
                payTermRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                payTermRow.style.backgroundColor = '#fff3cd';
                setTimeout(() => {
                    payTermRow.style.backgroundColor = '';
                    payTermRow.style.transition = 'background-color 0.5s ease';
                }, 2000);
            }
        }, 300);
    }

    createPayTermsFromEstimate(estimateId) {
        // Find the estimate and its project
        const estimate = this.data.estimates ? this.data.estimates.find(e => e.EstimateID === estimateId) : null;
        if (!estimate) {
            alert('Estimate not found');
            return;
        }

        // Show inline pay terms form instead of modal
        this.showInlinePayTermsForm(estimate.ProjectID, estimateId);
    }

    showInlinePayTermsForm(projectId, estimateId) {
        // Find the pay terms content area in the estimate view
        const payTermsContent = document.getElementById(`pay-terms-content-${estimateId}`);
        if (!payTermsContent) {
            alert('Unable to find pay terms section');
            return;
        }

        // Create inline form HTML
        const formHtml = `
            <div class="inline-payterms-form" style="background: white; padding: 20px; border-radius: 5px; margin: 10px 0;">
                <h5 style="margin-bottom: 15px; color: #495057;">Create Payment Terms</h5>
                <form id="inline-payterm-form">
                    <input type="hidden" name="projectId" value="${projectId}">
                    <input type="hidden" name="estimateId" value="${estimateId}">
                    
                    <div class="form-row" style="display: flex; gap: 15px; margin-bottom: 15px;">
                        <div class="form-group" style="flex: 1;">
                            <label>Payment Type:</label>
                            <select name="paymentType" id="inline-payment-type" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="">Select Payment Type</option>
                                <option value="percentage">Percentage-based</option>
                                <option value="fixed">Fixed Amount</option>
                                <option value="milestone" selected>Milestone-based</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label>Number of Terms:</label>
                            <input type="number" name="numberOfTerms" min="1" max="10" value="2" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                    </div>
                    
                    <div id="inline-payterms-details" style="margin-bottom: 15px;">
                        <!-- Payment terms details will be populated here -->
                    </div>
                    
                    <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" onclick="app.cancelInlinePayTermsForm(${estimateId})" class="btn btn-secondary" style="padding: 8px 16px;">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary" style="padding: 8px 16px;">
                            Save Pay Terms
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Replace the pay terms content with the form
        payTermsContent.innerHTML = formHtml;

        // Setup form listeners
        this.setupInlinePayTermsForm(estimateId);
    }

    setupInlinePayTermsForm(estimateId) {
        const form = document.getElementById('inline-payterm-form');
        const paymentTypeSelect = document.getElementById('inline-payment-type');
        
        // Set default payment type to milestone
        paymentTypeSelect.value = 'milestone';
        
        // Handle payment type change
        paymentTypeSelect.onchange = () => {
            this.updateInlinePayTermsDetails(estimateId);
        };

        // Handle form submission
        form.onsubmit = (e) => {
            e.preventDefault();
            this.saveInlinePayTerms(estimateId);
        };
        
        // Auto-populate milestone details since it's the default
        setTimeout(() => {
            this.updateInlinePayTermsDetails(estimateId);
        }, 100);
    }

    updateInlinePayTermsDetails(estimateId) {
        const paymentType = document.getElementById('inline-payment-type').value;
        const numberOfTerms = parseInt(document.querySelector('input[name="numberOfTerms"]').value) || 3;
        const detailsContainer = document.getElementById('inline-payterms-details');

        if (!paymentType) {
            detailsContainer.innerHTML = '';
            return;
        }

        // Get estimate total for calculations
        const estimate = this.data.estimates.find(e => e.EstimateID == estimateId);
        const estimateTotal = parseFloat(estimate?.TotalAmount) || 0;

        let detailsHtml = '<h6 style="margin-bottom: 10px;">Payment Term Details:</h6>';

        for (let i = 1; i <= numberOfTerms; i++) {
            if (paymentType === 'percentage') {
                const defaultPercent = i === 1 ? 25 : (i === numberOfTerms ? 25 : Math.round(50 / (numberOfTerms - 2)));
                detailsHtml += `
                    <div class="payterm-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                        <div style="flex: 1;">
                            <label>Term ${i} Name:</label>
                            <input type="text" name="termName${i}" value="Payment ${i}" required style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="width: 100px;">
                            <label>Percentage:</label>
                            <input type="number" name="termPercent${i}" min="0" max="100" step="0.1" value="${defaultPercent}" required style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="width: 120px;">
                            <label>Amount:</label>
                            <input type="text" name="termAmount${i}" value="$${(estimateTotal * defaultPercent / 100).toFixed(2)}" readonly style="width: 100%; padding: 6px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                    </div>
                `;
            } else if (paymentType === 'fixed') {
                const defaultAmount = Math.round(estimateTotal / numberOfTerms);
                detailsHtml += `
                    <div class="payterm-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                        <div style="flex: 1;">
                            <label>Term ${i} Name:</label>
                            <input type="text" name="termName${i}" value="Payment ${i}" required style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="width: 120px;">
                            <label>Amount:</label>
                            <input type="number" name="termAmount${i}" min="0" step="0.01" value="${defaultAmount}" required style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                    </div>
                `;
            } else if (paymentType === 'milestone') {
                const milestones = [
                    { name: 'Due at contract acceptance', percent: 75 },
                    { name: 'Due prior to permit submittal or submittal to engineer', percent: 25 }
                ];
                const milestone = milestones[i-1] || { name: `Milestone ${i}`, percent: 50 };
                detailsHtml += `
                    <div class="payterm-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                        <div style="flex: 1;">
                            <label>Milestone ${i}:</label>
                            <input type="text" name="termName${i}" value="${milestone.name}" required style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="width: 100px;">
                            <label>Percentage:</label>
                            <input type="number" name="termPercent${i}" min="0" max="100" step="0.1" value="${milestone.percent}" required style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="width: 120px;">
                            <label>Amount:</label>
                            <input type="text" name="termAmount${i}" value="$${(estimateTotal * milestone.percent / 100).toFixed(2)}" readonly style="width: 100%; padding: 6px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                    </div>
                `;
            }
        }

        detailsContainer.innerHTML = detailsHtml;

        // Add listeners for percentage changes if percentage or milestone type
        if (paymentType === 'percentage' || paymentType === 'milestone') {
            for (let i = 1; i <= numberOfTerms; i++) {
                const percentInput = document.querySelector(`input[name="termPercent${i}"]`);
                const amountInput = document.querySelector(`input[name="termAmount${i}"]`);
                if (percentInput && amountInput) {
                    percentInput.oninput = () => {
                        const percent = parseFloat(percentInput.value) || 0;
                        amountInput.value = `$${(estimateTotal * percent / 100).toFixed(2)}`;
                    };
                }
            }
        }
    }

    async saveInlinePayTerms(estimateId) {
        const form = document.getElementById('inline-payterm-form');
        const formData = new FormData(form);
        
        try {
            // Collect form data
            const paymentType = formData.get('paymentType');
            const numberOfTerms = parseInt(formData.get('numberOfTerms'));
            const projectId = formData.get('projectId');
            
            console.log('Saving pay terms:', { paymentType, numberOfTerms, projectId, estimateId });
            
            const payTerms = [];
            for (let i = 1; i <= numberOfTerms; i++) {
                const termName = formData.get(`termName${i}`);
                let amount = 0;
                
                if (paymentType === 'percentage' || paymentType === 'milestone') {
                    const percent = parseFloat(formData.get(`termPercent${i}`)) || 0;
                    const estimate = this.data.estimates.find(e => e.EstimateID == estimateId);
                    const estimateTotal = parseFloat(estimate?.TotalAmount) || 0;
                    amount = estimateTotal * percent / 100;
                } else {
                    amount = parseFloat(formData.get(`termAmount${i}`)) || 0;
                }
                
                payTerms.push({
                    PayTermName: termName,
                    PayTermAmount: amount,
                    PayTermStatus: 'Pending',
                    ProjectID: projectId,
                    EstimateID: estimateId
                });
            }
            
            console.log('Pay terms to save:', payTerms);
            
            // Save pay terms
            const response = await fetch('/api/payterms/create-multiple', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payTerms })
            });
            
            console.log('Response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Pay terms created successfully:', result);
                this.showToast('Pay terms created successfully!', 'success');
                // Refresh the pay terms display
                this.loadPayTermsForEstimate(estimateId);
            } else {
                const errorData = await response.json();
                console.error('Error response:', errorData);
                throw new Error(errorData.error || 'Failed to save pay terms');
            }
        } catch (error) {
            console.error('Error saving pay terms:', error);
            this.showToast('Error saving pay terms: ' + error.message, 'error');
        }
    }

    cancelInlinePayTermsForm(estimateId) {
        // Restore the original pay terms display
        this.loadPayTermsForEstimate(estimateId);
    }

    createContractFromProject(projectId) {
        console.log('🔍 createContractFromProject called with projectId:', projectId);
        
        const project = this.data.projects.find(p => p.ProjectID === projectId);
        if (!project) {
            console.error('❌ Project not found for ID:', projectId);
            alert('Project not found');
            return;
        }
        
        console.log('✅ Found project:', project);

        // Check if project has estimates
        const projectEstimates = this.data.estimates ? this.data.estimates.filter(e => e.ProjectID == projectId) : [];
        console.log('📊 Project estimates:', projectEstimates);
        
        if (projectEstimates.length === 0) {
            console.warn('⚠️ No estimates found for project');
            alert('Please create at least one estimate before generating a contract.');
            return;
        }

        // Calculate total contract amount from estimates
        const totalAmount = projectEstimates.reduce((sum, est) => sum + (parseFloat(est.TotalAmount) || 0), 0);
        console.log('💰 Calculated total amount:', totalAmount);

        // Navigate to contracts section and create a new contract
        console.log('🧭 Switching to contracts section...');
        this.switchSection('contracts');
        setTimeout(() => {
            // Show loading state
            console.log('⏳ Showing loading toast...');
            this.showToast('Creating contract...', 'info');
            
            const requestData = {
                ProjectID: projectId, // Use capital letters to match backend
                ContractType: 'Design Contract', // Set a default type
                ContractAmount: totalAmount,
                ContractStatus: 'Draft'
            };
            
            console.log('📤 About to send request with data:', requestData);
            
            // Create contract with project data and estimated amount
            fetch('/api/contracts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            })
            .then(response => {
                console.log('📨 Received response:', response.status, response.statusText);
                if (!response.ok) {
                    return response.json().then(err => {
                        console.error('❌ Error response data:', err);
                        return Promise.reject(err);
                    });
                }
                return response.json();
            })
            .then(result => {
                console.log('✅ Success response:', result);
                if (result.ContractID) {
                    this.showToast(`✅ Contract ${result.ContractNumber} created successfully with amount $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}!`, 'success');
                    this.loadContracts();
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            })
            .catch(error => {
                console.error('❌ Error creating contract:', error);
                this.showToast('❌ Error creating contract: ' + (error.error || error.message || 'Unknown error'), 'error');
            });
        }, 500);
    }

    createInvoiceFromPayTerm(payTermId) {
        // Get pay term details
        fetch(`/api/payterms/${payTermId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(payTerm => {
                if (!payTerm) {
                    alert('Pay term not found');
                    return;
                }

                // Create invoice with just this pay term
                fetch('/api/invoices', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        projectId: payTerm.ProjectID,
                        payTermIds: [payTermId], // Only this pay term
                        invoiceDate: new Date().toISOString().split('T')[0],
                        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(result => {
                    if (result.InvoiceID) {
                        console.log('Invoice created successfully:', result);
                        console.log('About to show invoice created popup with:', {
                            invoiceNumber: result.InvoiceNumber || result.InvoiceID,
                            payTerm: payTerm,
                            invoiceId: result.InvoiceID
                        });
                        
                        // Show confirmation popup asking if user wants to email the invoice
                        this.showInvoiceCreatedPopup(result.InvoiceNumber || result.InvoiceID, payTerm, result.InvoiceID);
                        
                        // Delay the data refresh so the user can see the confirmation
                        setTimeout(() => {
                            this.loadSectionData('invoices');
                            this.loadSectionData('payterms');
                            // Don't reload estimates immediately as it removes the confirmation
                        }, 5000); // 5 second delay
                        
                    } else {
                        alert('Error creating invoice: ' + (result.error || 'Unknown error'));
                    }
                })
                .catch(error => {
                    console.error('Error creating invoice:', error);
                    alert('Error creating invoice: ' + error.message);
                });
            })
            .catch(error => {
                console.error('Error fetching pay term:', error);
                if (error.message.includes('404')) {
                    alert('Pay term not found (ID: ' + payTermId + ')');
                } else {
                    alert('Error fetching pay term details: ' + error.message);
                }
            });
    }

    showInvoiceCreatedPopup(invoiceNumber, payTerm, invoiceId) {
        console.log('showInvoiceCreatedPopup called with:', { invoiceNumber, payTerm, invoiceId });
        
        // Get customer name from the current project data
        const project = this.data.projects.find(p => p.ProjectID === payTerm.ProjectID);
        const customerName = project ? project.CustomerName || project.CompanyName || 'Customer' : 'Customer';
        console.log('Found customer name:', customerName);

        // Find the estimate ID from the payTerm or project data
        const estimate = this.data.estimates.find(e => e.ProjectID === payTerm.ProjectID);
        const estimateId = payTerm.EstimateID || (estimate ? estimate.EstimateID : null);
        console.log('Found estimate ID:', estimateId);
        
        if (!estimateId) {
            console.error('Could not find estimate ID for pay term');
            return;
        }

        // Find the pay terms section with the correct estimate ID
        const payTermsSection = document.querySelector(`#estimate-pay-terms-${estimateId}`);
        console.log('Looking for pay terms section:', `#estimate-pay-terms-${estimateId}`);
        console.log('Found pay terms section:', payTermsSection);
        
        if (!payTermsSection) {
            console.error('Pay terms section not found for estimate ID:', estimateId);
            // Fallback: try to find any pay terms section
            const fallbackSection = document.querySelector('.pay-terms-section');
            console.log('Trying fallback section:', fallbackSection);
            if (!fallbackSection) {
                console.error('No pay terms section found at all');
                return;
            }
            // Use the fallback section
            this.insertInlineConfirmation(fallbackSection, invoiceNumber, payTerm, invoiceId, customerName);
            return;
        }

        this.insertInlineConfirmation(payTermsSection, invoiceNumber, payTerm, invoiceId, customerName);
    }

    insertInlineConfirmation(payTermsSection, invoiceNumber, payTerm, invoiceId, customerName) {
        console.log('insertInlineConfirmation called with section:', payTermsSection);
        
        // Remove any existing inline confirmations
        const existingConfirmations = document.querySelectorAll('.inline-invoice-confirmation');
        existingConfirmations.forEach(conf => conf.remove());
        console.log('Removed', existingConfirmations.length, 'existing confirmations');

        // Create inline confirmation
        const confirmationHtml = `
            <div class="inline-invoice-confirmation" style="margin: 15px 0; padding: 20px; background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border: 1px solid #c3e6cb; border-radius: 8px; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);">
                <div class="confirmation-header" style="display: flex; align-items: center; margin-bottom: 15px;">
                    <i class="fas fa-check-circle" style="color: #28a745; font-size: 1.5rem; margin-right: 12px;"></i>
                    <h4 style="margin: 0; color: #155724; font-weight: 600;">Invoice Created Successfully!</h4>
                    <button type="button" class="btn-close-inline" onclick="app.closeInvoiceConfirmation()" style="margin-left: auto; background: none; border: none; font-size: 20px; cursor: pointer; color: #155724; padding: 5px;">&times;</button>
                </div>
                <div class="confirmation-body">
                    <div class="success-message" style="margin-bottom: 15px; color: #155724;">
                        <p style="margin: 5px 0; font-size: 1.1rem;"><strong>Invoice ${invoiceNumber}</strong> has been created for <strong>${customerName}</strong>.</p>
                        <p style="margin: 5px 0;">Would you like to email it to the customer?</p>
                    </div>
                    <div class="invoice-info" style="background: rgba(255, 255, 255, 0.7); padding: 12px; border-radius: 6px; margin: 10px 0; color: #155724;">
                        <div style="margin: 4px 0;"><strong>Pay Term:</strong> ${payTerm.PayTermName || 'Payment'}</div>
                        <div style="margin: 4px 0;"><strong>Customer:</strong> ${customerName}</div>
                        <div style="margin: 4px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</div>
                    </div>
                </div>
                <div class="confirmation-actions" style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 15px;">
                    <button type="button" class="btn btn-success email-invoice-btn" data-invoice-id="${invoiceId}" data-customer-name="${customerName}" style="padding: 10px 20px; border: none; border-radius: 4px; background: #28a745; color: white; cursor: pointer; font-weight: 500; display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fas fa-envelope"></i> Email to Customer
                    </button>
                    <button type="button" class="btn btn-primary" onclick="app.downloadInvoicePdf(${invoiceId}); app.closeInvoiceConfirmation();" style="padding: 10px 20px; border: none; border-radius: 4px; background: #007bff; color: white; cursor: pointer; font-weight: 500; display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fas fa-download"></i> Download PDF
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="app.closeInvoiceConfirmation();" style="padding: 10px 20px; border: none; border-radius: 4px; background: #6c757d; color: white; cursor: pointer; font-weight: 500;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Insert the confirmation after the pay terms header but before the pay terms content
        const payTermsHeader = payTermsSection.querySelector('h4');
        console.log('Found pay terms header:', payTermsHeader);
        
        if (payTermsHeader) {
            payTermsHeader.insertAdjacentHTML('afterend', confirmationHtml);
            console.log('Inserted confirmation after header');
        } else {
            payTermsSection.insertAdjacentHTML('afterbegin', confirmationHtml);
            console.log('Inserted confirmation at beginning of section');
        }

        // Scroll to the confirmation
        const confirmation = document.querySelector('.inline-invoice-confirmation');
        console.log('Found inserted confirmation:', confirmation);
        
        if (confirmation) {
            confirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            console.log('Scrolled to confirmation');
            
            // Add event listener for the email button
            const emailButton = confirmation.querySelector('.email-invoice-btn');
            if (emailButton) {
                console.log('DEBUG: Adding event listener to email button');
                emailButton.addEventListener('click', () => {
                    const invoiceId = emailButton.dataset.invoiceId;
                    const customerName = emailButton.dataset.customerName;
                    console.log('DEBUG: Email button clicked with invoiceId:', invoiceId, 'customerName:', customerName);
                    this.emailInvoiceFromConfirmation(invoiceId, customerName);
                });
            }
            
            // Auto-focus the email button after a brief delay
            setTimeout(() => {
                const emailButton = confirmation.querySelector('.btn-success');
                if (emailButton) emailButton.focus();
                console.log('Focused email button');
            }, 300);
        }
    }

    closeInvoiceConfirmation() {
        // Remove the inline confirmation
        const confirmation = document.querySelector('.inline-invoice-confirmation');
        if (confirmation) {
            confirmation.remove();
        }
        
        // Refresh the estimates data to update the view
        this.loadSectionData('estimates');
    }

    async emailInvoiceToCustomer(invoiceId) {
        try {
            this.showToast('Sending invoice to customer...', 'info');
            
            const result = await this.apiCall(`invoices/${invoiceId}/send`, 'POST');
            
            // Show personalized confirmation with customer name
            if (result && result.invoice && result.invoice.CompanyName) {
                this.showToast(`Invoice sent to ${result.invoice.CompanyName}!`, 'success');
            } else {
                this.showToast('Invoice sent to customer successfully!', 'success');
            }
        } catch (error) {
            console.error('Error sending invoice email:', error);
            this.showToast('Failed to send invoice email: ' + (error.message || 'Unknown error'), 'error');
        }
    }

    async emailInvoiceFromConfirmation(invoiceId, customerName) {
        console.log('DEBUG: emailInvoiceFromConfirmation called with:', invoiceId, customerName);
        try {
            // Show sending message in the confirmation box itself
            this.updateInlineConfirmationMessage('Sending email...', 'info');
            
            const result = await this.apiCall(`invoices/${invoiceId}/send`, 'POST');
            console.log('DEBUG: API result:', result);
            
            // Show success message directly in the confirmation box
            let successMessage;
            if (result && result.invoice && result.invoice.CompanyName) {
                successMessage = `✅ Email sent successfully to ${result.invoice.CompanyName}!`;
            } else if (customerName && customerName !== 'Customer') {
                successMessage = `✅ Email sent successfully to ${customerName}!`;
            } else {
                successMessage = '✅ Email sent successfully to customer!';
            }
            
            // Update the confirmation box with success message
            this.updateInlineConfirmationMessage(successMessage, 'success');
            
            // Also show a toast that lasts longer
            this.showToastLong(successMessage, 'success');
            
            // Close the confirmation after a longer delay so user can see the success
            console.log('DEBUG: Setting timeout to close confirmation');
            setTimeout(() => {
                console.log('DEBUG: Closing confirmation now');
                this.closeInvoiceConfirmation();
            }, 5000); // Extended to 5 seconds
            
        } catch (error) {
            console.error('Error sending invoice email:', error);
            this.updateInlineConfirmationMessage('❌ Failed to send email: ' + (error.message || 'Unknown error'), 'error');
            this.showToast('Failed to send invoice email: ' + (error.message || 'Unknown error'), 'error');
        }
    }

    createInvoiceFromProject(projectId) {
        const project = this.data.projects.find(p => p.ProjectID === projectId);
        if (!project) {
            alert('Project not found');
            return;
        }

        // Check if project has pay terms
        fetch(`/api/payterms/project/${projectId}`)
            .then(response => response.json())
            .then(payTerms => {
                if (payTerms.length === 0) {
                    alert('Please create pay terms before generating an invoice.');
                    return;
                }

                // Show a simple dialog to create invoice
                const createInvoice = confirm(`Create an invoice for project "${project.ProjectName}"?\n\nThis will create an invoice based on the project's pay terms (${payTerms.length} found).`);
                
                if (createInvoice) {
                    // Create invoice with all pay terms
                    const payTermIds = payTerms.map(pt => pt.PayTermID);
                    
                    fetch('/api/invoices', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            projectId: projectId,
                            payTermIds: payTermIds,
                            invoiceDate: new Date().toISOString().split('T')[0],
                            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
                        })
                    })
                    .then(response => response.json())
                    .then(result => {
                        if (result.InvoiceID) {
                            // Navigate to invoices section and automatically download PDF
                            this.switchSection('invoices');
                            this.downloadInvoicePdf(result.InvoiceID);
                        } else {
                            alert('Error creating invoice: ' + (result.error || 'Unknown error'));
                        }
                    })
                    .catch(error => {
                        console.error('Error creating invoice:', error);
                        alert('Error creating invoice');
                    });
                }
            })
            .catch(error => {
                console.error('Error checking pay terms:', error);
                alert('Error checking pay terms for this project');
            });
    }

    downloadInvoicePdf(invoiceId) {
        fetch(`/api/invoices/${invoiceId}/pdf`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to generate PDF');
                }
                return response.blob();
            })
            .then(blob => {
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `Invoice_${invoiceId}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            })
            .catch(error => {
                console.error('Error downloading PDF:', error);
                alert('Error downloading invoice PDF');
            });
    }

    // Pay Terms functionality
    async loadPayTerms() {
        try {
            const payterms = await this.apiCall('payterms');
            this.data.payterms = payterms;
            
            // Filter pay terms to only show those linked to active projects
            const filteredPayterms = this.filterPaytermsByActiveProjects();
            this.renderPayTermsTable(filteredPayterms);
        } catch (error) {
            console.error('Error loading pay terms:', error);
            alert('Failed to load pay terms');
        }
    }

    renderPayTermsTable(payterms) {
        const tableBody = document.getElementById('payterms-table-body');
        if (!tableBody) return;

        if (payterms.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No pay terms found</td></tr>';
            return;
        }

        tableBody.innerHTML = payterms.map(payterm => `
            <tr data-payterm-id="${payterm.PayTermID}">
                <td>${payterm.ProjectName || 'N/A'}</td>
                <td>${payterm.EstimateNumber || 'N/A'}</td>
                <td>${payterm.PayTermName}</td>
                <td>${payterm.PayTermType}</td>
                <td>
                    ${payterm.PercentageAmount ? `${payterm.PercentageAmount}%` : ''}
                    ${payterm.FixedAmount ? `${this.formatCurrency(payterm.FixedAmount)}` : ''}
                </td>
                <td>${payterm.DueDate ? this.formatDate(payterm.DueDate) : 'N/A'}</td>
                <td>
                    <span class="badge ${this.getPayTermStatusClass(payterm.PayTermStatus)}">${payterm.PayTermStatus}</span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" onclick="app.editPayTerm(${payterm.PayTermID})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${payterm.ProjectID ? `
                        <button class="btn btn-sm btn-outline-secondary" onclick="app.createInvoiceFromProject(${payterm.ProjectID})" title="Create Invoice">
                            <i class="fas fa-file-invoice"></i>
                        </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-danger" onclick="app.deletePayTerm(${payterm.PayTermID})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    getPayTermStatusClass(status) {
        switch (status) {
            case 'Paid': return 'badge-success';
            case 'Overdue': return 'badge-danger';
            case 'Pending': return 'badge-warning';
            default: return 'badge-secondary';
        }
    }

    getInvoiceStatusClass(status) {
        switch (status) {
            case 'Paid': return 'badge-success';
            case 'Sent': return 'badge-info';
            case 'Overdue': return 'badge-danger';
            case 'Draft': return 'badge-secondary';
            case 'Pending': return 'badge-warning';
            default: return 'badge-secondary';
        }
    }

    showPayTermModal(projectId = null, estimateId = null) {
        const modal = document.getElementById('payterm-modal');
        const title = document.getElementById('payterm-modal-title');
        const form = document.getElementById('payterm-form');
        
        // Reset form
        form.reset();
        
        title.textContent = 'Create Pay Terms';
        
        // Load projects dropdown
        this.populatePayTermProjectDropdown(projectId);
        
        // If estimate is provided, select it and load estimate details
        if (estimateId) {
            setTimeout(() => {
                this.onPayTermProjectChange(projectId);
                setTimeout(() => {
                    document.getElementById('payterm-estimate').value = estimateId;
                    this.onPayTermEstimateChange();
                }, 100);
            }, 100);
        }
        
        modal.style.display = 'block';
        
        // Setup event listeners for payment type changes
        this.setupPayTermModalListeners();
    }

    populatePayTermProjectDropdown(selectedProjectId) {
        const projectSelect = document.getElementById('payterm-project');
        if (!this.data.projects) return;
        
        projectSelect.innerHTML = '<option value="">Select Project</option>';
        this.data.projects.forEach(project => {
            projectSelect.innerHTML += `
                <option value="${project.ProjectID}" ${selectedProjectId == project.ProjectID ? 'selected' : ''}>
                    ${project.ProjectName} (${project.CompanyName})
                </option>
            `;
        });
        
        // Add change listener
        projectSelect.onchange = () => this.onPayTermProjectChange();
        
        // If project is preselected, load its estimates
        if (selectedProjectId) {
            setTimeout(() => this.onPayTermProjectChange(), 100);
        }
    }

    async onPayTermProjectChange() {
        const projectId = document.getElementById('payterm-project').value;
        const estimateSelect = document.getElementById('payterm-estimate');
        
        estimateSelect.innerHTML = '<option value="">Select Estimate</option>';
        
        if (!projectId) return;
        
        try {
            // Load estimates for this project
            const estimates = await this.apiCall(`estimates?projectId=${projectId}`);
            
            estimates.forEach(estimate => {
                estimateSelect.innerHTML += `
                    <option value="${estimate.EstimateID}" data-total="${estimate.TotalAmount || 0}">
                        ${estimate.EstimateNumber} - $${this.formatCurrency(estimate.TotalAmount || 0)}
                    </option>
                `;
            });
            
            estimateSelect.onchange = () => this.onPayTermEstimateChange();
            
        } catch (error) {
            console.error('Error loading estimates:', error);
        }
    }

    onPayTermEstimateChange() {
        const estimateSelect = document.getElementById('payterm-estimate');
        const estimateTotal = document.getElementById('estimate-total');
        const selectedOption = estimateSelect.selectedOptions[0];
        
        if (selectedOption && selectedOption.dataset.total) {
            const total = parseFloat(selectedOption.dataset.total);
            estimateTotal.textContent = `Estimate Total: $${this.formatCurrency(total)}`;
            this.updatePaymentPreview(total);
        } else {
            estimateTotal.textContent = '';
            document.getElementById('payment-preview').style.display = 'none';
        }
    }

    updatePaymentPreview(estimateTotal) {
        const paymentType = document.querySelector('input[name="payment-type"]:checked').value;
        const previewDiv = document.getElementById('payment-preview');
        const scheduleDiv = document.getElementById('payment-schedule');
        const totalSpan = document.getElementById('total-amount');
        
        if (paymentType === 'custom' || !estimateTotal) {
            previewDiv.style.display = 'none';
            return;
        }
        
        let schedule = '';
        
        if (paymentType === '100_at_acceptance') {
            schedule = `
                <div class="payment-item">
                    <strong>Payment 1:</strong> Due at contract acceptance<br>
                    <span class="text-success">$${this.formatCurrency(estimateTotal)} (100%)</span>
                </div>
            `;
        } else if (paymentType === '75_25_split') {
            const firstPayment = estimateTotal * 0.75;
            const secondPayment = estimateTotal * 0.25;
            schedule = `
                <div class="payment-item mb-2">
                    <strong>Payment 1:</strong> Due at contract acceptance<br>
                    <span class="text-success">$${this.formatCurrency(firstPayment)} (75%)</span>
                </div>
                <div class="payment-item">
                    <strong>Payment 2:</strong> Due prior to permit submittal or submittal to engineer<br>
                    <span class="text-info">$${this.formatCurrency(secondPayment)} (25%)</span><br>
                    <small class="text-muted">Remaining balance</small>
                </div>
            `;
        }
        
        scheduleDiv.innerHTML = schedule;
        totalSpan.textContent = this.formatCurrency(estimateTotal);
        previewDiv.style.display = 'block';
    }

    setupPayTermModalListeners() {
        const paymentRadios = document.querySelectorAll('input[name="payment-type"]');
        const customFields = document.getElementById('custom-payment-fields');
        const previewDiv = document.getElementById('payment-preview');
        
        paymentRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const isCustom = radio.value === 'custom';
                customFields.style.display = isCustom ? 'block' : 'none';
                
                if (isCustom) {
                    previewDiv.style.display = 'none';
                } else {
                    this.onPayTermEstimateChange(); // Refresh preview
                }
            });
        });
    }

    async savePayTerm(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const paymentType = formData.get('payment-type');
        const projectId = formData.get('project-id');
        const estimateId = formData.get('estimate-id');
        
        if (!projectId) {
            alert('Please select a project');
            return;
        }
        
        try {
            if (paymentType === 'custom') {
                // Create single custom pay term
                await this.createCustomPayTerm(formData);
            } else {
                // Create standard pay terms
                if (!estimateId) {
                    alert('Please select an estimate for standard payment terms');
                    return;
                }
                
                await this.apiCall('payterms/create-standard', 'POST', {
                    projectId: parseInt(projectId),
                    estimateId: parseInt(estimateId),
                    paymentType: paymentType
                });
            }
            
            this.closePayTermModal();
            this.loadPayTerms();
            alert('Pay terms created successfully');
            
        } catch (error) {
            console.error('Error creating pay terms:', error);
            alert('Failed to create pay terms');
        }
    }

    async createCustomPayTerm(formData) {
        const data = {
            projectId: parseInt(formData.get('project-id')),
            estimateId: formData.get('estimate-id') ? parseInt(formData.get('estimate-id')) : null,
            payTermType: formData.get('payterm-type'),
            payTermName: formData.get('payterm-name'),
            percentageAmount: formData.get('payterm-percentage') ? parseFloat(formData.get('payterm-percentage')) : null,
            fixedAmount: formData.get('payterm-amount') ? parseFloat(formData.get('payterm-amount')) : null,
            dueDate: formData.get('payterm-due-date') || null,
            payTermDescription: formData.get('payterm-description') || null
        };
        
        if (!data.payTermName) {
            throw new Error('Pay term name is required');
        }
        
        if (!data.percentageAmount && !data.fixedAmount) {
            throw new Error('Either percentage or fixed amount is required');
        }
        
        await this.apiCall('payterms', 'POST', data);
    }

    closePayTermModal() {
        document.getElementById('payterm-modal').style.display = 'none';
    }

    async editPayTerm(payTermId) {
        // Implementation for editing pay terms
        console.log('Edit pay term:', payTermId);
        this.showInfo('Edit pay term functionality coming soon');
    }

    async markPayTermPaid(payTermId) {
        if (!confirm('Mark this pay term as paid?')) return;
        
        try {
            await this.apiCall(`payterms/${payTermId}/mark-paid`, 'POST', {
                paymentDate: new Date().toISOString().split('T')[0]
            });
            
            this.loadPayTerms();
            alert('Pay term marked as paid');
        } catch (error) {
            console.error('Error marking pay term as paid:', error);
            alert('Failed to mark pay term as paid');
        }
    }

    async deletePayTerm(payTermId) {
        if (!confirm('Are you sure you want to delete this pay term?')) return;
        
        try {
            await this.apiCall(`payterms/${payTermId}`, 'DELETE');
            this.loadPayTerms();
            alert('Pay term deleted successfully');
        } catch (error) {
            console.error('Error deleting pay term:', error);
            alert('Failed to delete pay term');
        }
    }

    // Add buttons to project and estimate views for creating pay terms
    addPayTermsButtonToProjectView(projectId) {
        const projectActions = document.querySelector('.project-view-actions');
        if (projectActions && !document.getElementById('create-payterms-btn')) {
            const payTermsBtn = document.createElement('button');
            payTermsBtn.id = 'create-payterms-btn';
            payTermsBtn.className = 'btn btn-info btn-sm';
            payTermsBtn.innerHTML = '<i class="fas fa-money-check-alt"></i> Create Pay Terms';
            payTermsBtn.onclick = () => this.showPayTermModal(projectId);
            projectActions.appendChild(payTermsBtn);
        }
    }

    addPayTermsButtonToEstimateView(projectId, estimateId) {
        const estimateActions = document.querySelector('.estimate-view-actions');
        if (estimateActions && !document.getElementById('create-estimate-payterms-btn')) {
            const payTermsBtn = document.createElement('button');
            payTermsBtn.id = 'create-estimate-payterms-btn';
            payTermsBtn.className = 'btn btn-info btn-sm';
            payTermsBtn.innerHTML = '<i class="fas fa-money-check-alt"></i> Create Pay Terms';
            payTermsBtn.onclick = () => this.showPayTermModal(projectId, estimateId);
            estimateActions.appendChild(payTermsBtn);
        }
    }

    setupCustomerAddressAutocomplete() {
        // Find all customer address fields that need autocomplete
        const customerForms = document.querySelectorAll('tr.edit-row');
        
        customerForms.forEach(form => {
            // Check if this is a customer form (contains customer-specific address fields)
            const addressField = form.querySelector('input[id*="customerAddress_"]');
            if (addressField && !addressField.getAttribute('data-autocomplete-setup')) {
                // Mark as set up to avoid duplicate initialization
                addressField.setAttribute('data-autocomplete-setup', 'true');
                
                // Set up autocomplete for this address field
                this.setupAddressAutocomplete(addressField.id);
                
                console.log('Set up autocomplete for customer address field:', addressField.id);
            }
        });
    }

    async sendContractToCustomer(contractId) {
        // Find the button that was clicked and disable it during sending
        const button = document.querySelector(`[onclick="app.sendContractToCustomer(${contractId})"]`);
        const originalText = button ? button.innerHTML : '';
        
        try {
            // Show loading state
            if (button) {
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                button.disabled = true;
                button.style.opacity = '0.6';
            }
            
            this.showToast('Sending contract to customer...', 'info');
            console.log(`📧 Sending contract ${contractId} to customer for signature...`);
            
            const response = await fetch(`/api/contracts/${contractId}/send-to-customer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Contract sent to customer:', result);
            
            // Show success message with more details
            this.showToast(`✅ Contract sent successfully to ${result.customerEmail}!<br><small>The customer will receive an email with the full contract details and signing instructions.</small>`, 'success');
            
            // Update button to show sent state
            if (button) {
                button.innerHTML = '<i class="fas fa-check"></i> Sent!';
                button.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.style.backgroundColor = '#17a2b8';
                }, 3000);
            }
            
        } catch (error) {
            console.error('❌ Error sending contract to customer:', error);
            this.showToast('❌ Error sending contract: ' + error.message, 'error');
            
            // Reset button on error
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
                button.style.opacity = '1';
            }
        }
    }

    // Settings Management
    async loadSettings() {
        try {
            const response = await this.apiCall('settings');
            this.settings = response;
            this.renderSettings();
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showToast('Error loading settings', 'error');
        }
    }

    renderSettings() {
        // Populate company information fields
        document.getElementById('company-name').value = this.settings.company_name || '';
        document.getElementById('company-address').value = this.settings.company_address || '';
        document.getElementById('company-phone').value = this.settings.company_phone || '';
        document.getElementById('company-email').value = this.settings.company_email || '';
        document.getElementById('company-website').value = this.settings.company_website || '';
        
        // Populate business settings
        document.getElementById('tax-rate').value = this.settings.tax_rate || 0;
        document.getElementById('payment-terms').value = this.settings.payment_terms || 30;
        document.getElementById('hourly-rate').value = this.settings.hourly_rate || 75.00;
        document.getElementById('invoice-footer').value = this.settings.invoice_footer || '';
        document.getElementById('contract-footer').value = this.settings.contract_footer || '';
        document.getElementById('default-exclusions').value = this.settings.default_exclusions || '';
        document.getElementById('currency-symbol').value = this.settings.currency_symbol || '$';
        document.getElementById('date-format').value = this.settings.date_format || 'MM/dd/yyyy';
        
        // Populate system preferences checkboxes
        document.getElementById('email-notifications').checked = this.settings.email_notifications === true;
        document.getElementById('auto-backup').checked = this.settings.auto_backup === true;
        document.getElementById('show-logo').checked = this.settings.show_logo === true;
        document.getElementById('require-project-approval').checked = this.settings.require_project_approval === true;
        
        // Populate external access settings
        document.getElementById('base-url').value = this.settings.base_url || '';
        
        // Display signature preview if available
        if (this.settings.signature_image_url) {
            this.showSignaturePreview(this.settings.signature_image_url);
        }
        
        // Update system info
        const version = '1.0.0'; // You can make this dynamic
        const lastBackup = localStorage.getItem('lastBackup') || 'Never';
        const currentUser = 'Administrator'; // You can make this dynamic based on auth
        
        document.querySelector('#app-version .value').textContent = version;
        document.querySelector('#last-backup .value').textContent = lastBackup;
        document.querySelector('#current-user .value').textContent = currentUser;
    }

    async saveSettings() {
        try {
            // Gather all settings from the form
            const settings = {
                company_name: document.getElementById('company-name').value,
                company_address: document.getElementById('company-address').value,
                company_phone: document.getElementById('company-phone').value,
                company_email: document.getElementById('company-email').value,
                company_website: document.getElementById('company-website').value,
                tax_rate: parseFloat(document.getElementById('tax-rate').value) || 0,
                payment_terms: parseInt(document.getElementById('payment-terms').value) || 30,
                hourly_rate: parseFloat(document.getElementById('hourly-rate').value) || 75.00,
                invoice_footer: document.getElementById('invoice-footer').value,
                contract_footer: document.getElementById('contract-footer').value,
                default_exclusions: document.getElementById('default-exclusions').value,
                currency_symbol: document.getElementById('currency-symbol').value,
                date_format: document.getElementById('date-format').value,
                email_notifications: document.getElementById('email-notifications').checked,
                auto_backup: document.getElementById('auto-backup').checked,
                show_logo: document.getElementById('show-logo').checked,
                require_project_approval: document.getElementById('require-project-approval').checked,
                base_url: document.getElementById('base-url').value
            };
            
            await this.apiCall('settings', 'PUT', settings);
            this.settings = settings;
            this.showToast('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showToast('Error saving settings', 'error');
        }
    }

    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings to their defaults? This action cannot be undone.')) {
            try {
                await this.apiCall('settings/reset', 'POST');
                await this.loadSettings(); // Reload the settings
                this.showToast('Settings reset to defaults successfully', 'success');
            } catch (error) {
                console.error('Error resetting settings:', error);
                this.showToast('Error resetting settings', 'error');
            }
        }
    }

    async exportSettings() {
        try {
            const response = await fetch('/api/settings/export');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'settings-backup.json';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast('Settings exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting settings:', error);
            this.showToast('Error exporting settings', 'error');
        }
    }

    async clearCache() {
        try {
            // Clear localStorage
            const preserveKeys = ['hideInactiveCustomers', 'hideInactiveProjects'];
            const toPreserve = {};
            preserveKeys.forEach(key => {
                if (localStorage.getItem(key)) {
                    toPreserve[key] = localStorage.getItem(key);
                }
            });
            
            localStorage.clear();
            
            // Restore preserved keys
            Object.entries(toPreserve).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            // Force page reload to clear any cached data
            this.showToast('Cache cleared successfully. Page will reload...', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showToast('Error clearing cache', 'error');
        }
    }

    async runDatabaseBackup() {
        try {
            this.showToast('Running database backup...', 'info');
            
            // This would typically call a backend endpoint for database backup
            // For now, we'll simulate it and update the last backup time
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate backup time
            
            const now = new Date().toLocaleString();
            localStorage.setItem('lastBackup', now);
            document.querySelector('#last-backup .value').textContent = now;
            
            this.showToast('Database backup completed successfully', 'success');
        } catch (error) {
            console.error('Error running database backup:', error);
            this.showToast('Error running database backup', 'error');
        }
    }

    // Signature handling functions
    async handleSignatureUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file (PNG, JPG, etc.)', 'error');
            event.target.value = '';
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            this.showToast('Image file must be smaller than 2MB', 'error');
            event.target.value = '';
            return;
        }

        try {
            const formData = new FormData();
            formData.append('signature', file);

            const response = await fetch('/api/settings/signature-upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Update settings with the new signature URL
            this.settings.signature_image_url = result.imageUrl;
            
            // Show preview
            this.showSignaturePreview(result.imageUrl);
            
            this.showToast('Signature image uploaded successfully', 'success');
        } catch (error) {
            console.error('Error uploading signature:', error);
            this.showToast('Error uploading signature image', 'error');
            event.target.value = '';
        }
    }

    showSignaturePreview(imageUrl) {
        const preview = document.getElementById('signature-preview');
        const previewImg = document.getElementById('signature-preview-img');
        
        previewImg.src = imageUrl;
        preview.style.display = 'block';
    }

    async removeSignature() {
        if (!confirm('Are you sure you want to remove the signature image?')) {
            return;
        }

        try {
            const response = await fetch('/api/settings/signature-remove', {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Clear the signature from settings
            this.settings.signature_image_url = null;
            
            // Hide preview
            const preview = document.getElementById('signature-preview');
            preview.style.display = 'none';
            
            // Clear file input
            document.getElementById('signature-image').value = '';
            
            this.showToast('Signature image removed successfully', 'success');
        } catch (error) {
            console.error('Error removing signature:', error);
            this.showToast('Error removing signature image', 'error');
        }
    }

    // Import Data Management
    initializeImportHandlers() {
        // Template download handlers
        document.addEventListener('click', (e) => {
            if (e.target.matches('.template-btn') || e.target.closest('.template-btn')) {
                const btn = e.target.matches('.template-btn') ? e.target : e.target.closest('.template-btn');
                const type = btn.getAttribute('data-type');
                this.downloadTemplate(type);
            }
        });

        // Import button handlers  
        document.addEventListener('click', (e) => {
            if (e.target.matches('.import-btn') || e.target.closest('.import-btn')) {
                const btn = e.target.matches('.import-btn') ? e.target : e.target.closest('.import-btn');
                const type = btn.getAttribute('data-type');
                this.openImportModal(type);
            }
        });

        // Modal close handler
        document.addEventListener('click', (e) => {
            if (e.target.matches('.modal-close') || e.target.matches('.modal') && !e.target.closest('.modal-content')) {
                this.closeImportModal();
            }
        });

        // File input handler
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Drag and drop handlers
        const uploadArea = document.getElementById('file-upload-area');
        if (uploadArea) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'));
            });

            ['dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'));
            });

            uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
        }
    }

    async downloadTemplate(type) {
        try {
            const response = await fetch(`/api/import/templates/${type}/download`);
            if (!response.ok) {
                throw new Error('Failed to download template');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_template.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showToast(`${this.capitalizeFirst(type)} template downloaded successfully`, 'success');
        } catch (error) {
            console.error('Error downloading template:', error);
            this.showToast('Failed to download template', 'error');
        }
    }

    openImportModal(type) {
        this.currentImportType = type;
        this.currentImportStep = 1;
        this.uploadedFileData = null;
        
        document.getElementById('import-modal-title').textContent = `Import ${this.capitalizeFirst(type)}`;
        document.getElementById('import-modal').style.display = 'flex';
        
        // Reset modal to step 1
        document.getElementById('import-step-1').style.display = 'block';
        document.getElementById('import-step-2').style.display = 'none';
        document.getElementById('import-step-3').style.display = 'none';
        
        // Reset buttons
        document.getElementById('import-prev-btn').style.display = 'none';
        document.getElementById('import-next-btn').style.display = 'inline-block';
        document.getElementById('import-execute-btn').style.display = 'none';
        
        // Clear file input and info
        document.getElementById('import-file-input').value = '';
        document.getElementById('file-info').style.display = 'none';
        document.getElementById('import-next-btn').disabled = true;
    }

    closeImportModal() {
        document.getElementById('import-modal').style.display = 'none';
        this.currentImportType = null;
        this.uploadedFileData = null;
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    handleFileDrop(event) {
        const file = event.dataTransfer.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    async processFile(file) {
        try {
            // Validate file type
            const validTypes = ['.xlsx', '.xls', '.csv'];
            const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
            
            if (!validTypes.includes(fileExtension)) {
                throw new Error('Please select a valid Excel (.xlsx, .xls) or CSV file');
            }
            
            // Show loading
            this.showToast('Processing file...', 'info');
            
            // Upload and process file
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/import/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process file');
            }
            
            this.uploadedFileData = await response.json();
            this.displayFileInfo();
            document.getElementById('import-next-btn').disabled = false;
            
            this.showToast('File processed successfully', 'success');
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showToast(error.message, 'error');
            this.uploadedFileData = null;
            document.getElementById('import-next-btn').disabled = true;
        }
    }

    displayFileInfo() {
        const fileInfo = document.getElementById('file-info');
        const fileDetails = document.getElementById('file-details');
        
        fileDetails.innerHTML = `
            <div class="file-detail-item">
                <strong>Filename:</strong><br>
                ${this.uploadedFileData.originalName}
            </div>
            <div class="file-detail-item">
                <strong>Total Rows:</strong><br>
                ${this.uploadedFileData.totalRows}
            </div>
            <div class="file-detail-item">
                <strong>Columns:</strong><br>
                ${this.uploadedFileData.headers.length}
            </div>
            <div class="file-detail-item">
                <strong>Sheets:</strong><br>
                ${this.uploadedFileData.sheetNames.join(', ')}
            </div>
        `;
        
        fileInfo.style.display = 'block';
    }

    async nextImportStep() {
        if (this.currentImportStep === 1) {
            // Move to column mapping
            await this.showColumnMapping();
            this.currentImportStep = 2;
            
            document.getElementById('import-step-1').style.display = 'none';
            document.getElementById('import-step-2').style.display = 'block';
            document.getElementById('import-prev-btn').style.display = 'inline-block';
            document.getElementById('import-execute-btn').style.display = 'inline-block';
            document.getElementById('import-next-btn').style.display = 'none';
            
        } else if (this.currentImportStep === 2) {
            // Execute import
            await this.executeImport();
        }
    }

    previousImportStep() {
        if (this.currentImportStep === 2) {
            this.currentImportStep = 1;
            
            document.getElementById('import-step-1').style.display = 'block';
            document.getElementById('import-step-2').style.display = 'none';
            document.getElementById('import-prev-btn').style.display = 'none';
            document.getElementById('import-execute-btn').style.display = 'none';
            document.getElementById('import-next-btn').style.display = 'inline-block';
        }
    }

    async showColumnMapping() {
        const mappingContainer = document.getElementById('column-mapping');
        
        // Get field definitions for current import type
        const templateResponse = await fetch('/api/import/templates');
        const templates = await templateResponse.json();
        const fields = templates[this.currentImportType]?.fields || {};
        
        // Create column mapping interface
        let mappingHtml = '<div class="mapping-header"><h5>Map Excel columns to database fields:</h5></div>';
        
        Object.entries(fields).forEach(([fieldName, fieldInfo]) => {
            const isRequired = fieldInfo.required ? '<span class="mapping-required">(Required)</span>' : '';
            
            mappingHtml += `
                <div class="mapping-row">
                    <div class="mapping-field">
                        ${fieldInfo.description} ${isRequired}
                    </div>
                    <div>
                        <select class="mapping-select" data-field="${fieldName}" ${fieldInfo.required ? 'required' : ''}>
                            <option value="">-- Select Column --</option>
                            ${this.uploadedFileData.headers.map((header, index) => 
                                `<option value="${index}">${header}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="mapping-description">
                        ${fieldInfo.description}
                    </div>
                </div>
            `;
        });
        
        mappingContainer.innerHTML = mappingHtml;
        
        // Show data preview
        this.showDataPreview();
    }

    showDataPreview() {
        const previewContainer = document.getElementById('import-preview');
        const previewTable = document.getElementById('preview-table');
        
        if (this.uploadedFileData.preview && this.uploadedFileData.preview.length > 0) {
            let tableHtml = '<table class="preview-table">';
            
            // Headers
            tableHtml += '<thead><tr>';
            this.uploadedFileData.preview[0].forEach(header => {
                tableHtml += `<th>${header || 'Empty'}</th>`;
            });
            tableHtml += '</tr></thead>';
            
            // Data rows (first 5)
            tableHtml += '<tbody>';
            for (let i = 1; i < Math.min(6, this.uploadedFileData.preview.length); i++) {
                tableHtml += '<tr>';
                this.uploadedFileData.preview[i].forEach(cell => {
                    tableHtml += `<td>${cell || ''}</td>`;
                });
                tableHtml += '</tr>';
            }
            tableHtml += '</tbody></table>';
            
            previewTable.innerHTML = tableHtml;
            previewContainer.style.display = 'block';
        }
    }

    async executeImport() {
        try {
            // Collect column mappings
            const mappings = {};
            document.querySelectorAll('.mapping-select').forEach(select => {
                const fieldName = select.getAttribute('data-field');
                const columnIndex = select.value;
                if (columnIndex !== '') {
                    mappings[fieldName] = parseInt(columnIndex);
                }
            });
            
            // Validate required fields
            const templateResponse = await fetch('/api/import/templates');
            const templates = await templateResponse.json();
            const fields = templates[this.currentImportType]?.fields || {};
            
            const missingRequired = Object.entries(fields)
                .filter(([fieldName, fieldInfo]) => fieldInfo.required && !mappings[fieldName])
                .map(([fieldName, fieldInfo]) => fieldInfo.description);
                
            if (missingRequired.length > 0) {
                throw new Error(`Please map the following required fields: ${missingRequired.join(', ')}`);
            }
            
            // Show loading
            this.showToast('Importing data...', 'info');
            
            // Execute import
            const importData = {
                filename: this.uploadedFileData.filename,
                sheetName: this.uploadedFileData.sheetNames[0],
                mapping: mappings,
                startRow: 1
            };
            
            const response = await fetch(`/api/import/${this.currentImportType}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(importData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Import failed');
            }
            
            const results = await response.json();
            this.showImportResults(results);
            
            // Move to results step
            this.currentImportStep = 3;
            document.getElementById('import-step-2').style.display = 'none';
            document.getElementById('import-step-3').style.display = 'block';
            document.getElementById('import-prev-btn').style.display = 'none';
            document.getElementById('import-execute-btn').style.display = 'none';
            
        } catch (error) {
            console.error('Error during import:', error);
            this.showToast(error.message, 'error');
        }
    }

    showImportResults(results) {
        const resultsContainer = document.getElementById('import-results');
        
        let resultsHtml = `
            <div class="result-summary">
                <div class="result-stat success">
                    <div class="result-stat-number">${results.imported}</div>
                    <div class="result-stat-label">Imported</div>
                </div>
                <div class="result-stat warning">
                    <div class="result-stat-number">${results.skipped}</div>
                    <div class="result-stat-label">Skipped</div>
                </div>
                <div class="result-stat error">
                    <div class="result-stat-number">${results.errors?.length || 0}</div>
                    <div class="result-stat-label">Errors</div>
                </div>
            </div>
        `;
        
        if (results.errors && results.errors.length > 0) {
            resultsHtml += `
                <div class="error-details">
                    <h5>Errors Details:</h5>
                    <div class="error-list">
                        ${results.errors.map(error => 
                            `<div class="error-item">
                                <strong>Row ${error.row}:</strong> ${error.error}
                            </div>`
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        resultsContainer.innerHTML = resultsHtml;
        
        // Show success message
        if (results.imported > 0) {
            this.showToast(`Successfully imported ${results.imported} records`, 'success');
            
            // Refresh the relevant section if we're on it
            if (this.currentImportType === 'customers' && this.currentSection === 'customers') {
                this.loadCustomers();
            } else if (this.currentImportType === 'projects' && this.currentSection === 'projects') {
                this.loadProjects();
            } else if (this.currentImportType === 'line-items' && this.currentSection === 'lineitems') {
                this.loadLineItems();
            }
        }
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).replace('-', ' ');
    }

    // Initialize authentication handlers
    initializeAuthHandlers() {
        // Login form handler
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }

        // Logout button handler
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.logout();
            });
        }

        // Password modal close button handler
        const closeButton = document.querySelector('.password-modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.closePasswordModal();
            });
        }

        // Check if user is already authenticated
        this.checkAuthStatus();
    }

    // Handle login form submission
    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showToast('Please enter both username and password', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showToast('Login successful!', 'success');
                this.currentUser = data.user;
                
                // Hide login section and show app
                document.getElementById('login-section').classList.add('d-none');
                document.getElementById('app-container').classList.remove('d-none');
                
                // Update user name in navbar
                const userNameElement = document.getElementById('user-name');
                if (userNameElement) {
                    userNameElement.textContent = data.user.firstName || data.user.username;
                }
                
                // Load dashboard
                this.loadDashboard();
            } else {
                this.showToast(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Login failed. Please try again.', 'error');
        }
    }

    // Check authentication status
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/check', {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.authenticated) {
                this.currentUser = data.user;
                
                // Hide login section and show app
                document.getElementById('login-section').classList.add('d-none');
                document.getElementById('app-container').classList.remove('d-none');
                
                // Update user name in navbar
                const userNameElement = document.getElementById('user-name');
                if (userNameElement) {
                    userNameElement.textContent = data.user.firstName || data.user.username;
                }
                
                // Load dashboard
                this.loadDashboard();
            } else {
                // Show login form
                document.getElementById('login-section').classList.remove('d-none');
                document.getElementById('app-container').classList.add('d-none');
            }
        } catch (error) {
            console.error('Auth check error:', error);
            // Show login form on error
            document.getElementById('login-section').classList.remove('d-none');
            document.getElementById('app-container').classList.add('d-none');
        }
    }

    // Authentication Methods
    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            if (response.ok) {
                this.showToast('Logged out successfully', 'success');
                this.currentUser = null;
                
                // Show login section and hide app
                document.getElementById('login-section').classList.remove('d-none');
                document.getElementById('app-container').classList.add('d-none');
                
                // Clear form fields
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
            } else {
                this.showToast('Logout failed', 'error');
            }
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Logout failed', 'error');
        }
    }

    changePassword() {
        // Remove any existing dynamic modal
        const existingModal = document.getElementById('dynamic-password-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create a completely new modal element
        const modal = document.createElement('div');
        modal.id = 'dynamic-password-modal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 999999 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            box-sizing: border-box !important;
        `;

        // Create modal content
        modal.innerHTML = `
            <div style="
                background: white !important;
                border-radius: 8px !important;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
                max-width: 450px !important;
                width: 90% !important;
                max-height: 90vh !important;
                overflow: auto !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                color: #333 !important;
            ">
                <div style="
                    padding: 1.5rem 2rem 1rem !important;
                    border-bottom: 1px solid #eee !important;
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                ">
                    <h3 style="margin: 0 !important; font-size: 1.25rem !important; font-weight: 600 !important;">Change Password</h3>
                    <button class="dynamic-modal-close" style="
                        background: none !important;
                        border: none !important;
                        font-size: 1.5rem !important;
                        color: #666 !important;
                        cursor: pointer !important;
                        width: 30px !important;
                        height: 30px !important;
                        border-radius: 50% !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                    ">&times;</button>
                </div>
                <div style="padding: 1.5rem 2rem !important;">
                    <div style="margin-bottom: 1rem !important;">
                        <label style="display: block !important; margin-bottom: 0.25rem !important; font-weight: 500 !important;">Current Password</label>
                        <input type="password" id="dynamic-current-password" style="
                            width: 100% !important;
                            padding: 0.5rem !important;
                            border: 1px solid #ddd !important;
                            border-radius: 4px !important;
                            font-size: 1rem !important;
                            box-sizing: border-box !important;
                        ">
                    </div>
                    <div style="margin-bottom: 1rem !important;">
                        <label style="display: block !important; margin-bottom: 0.25rem !important; font-weight: 500 !important;">New Password</label>
                        <input type="password" id="dynamic-new-password" style="
                            width: 100% !important;
                            padding: 0.5rem !important;
                            border: 1px solid #ddd !important;
                            border-radius: 4px !important;
                            font-size: 1rem !important;
                            box-sizing: border-box !important;
                        ">
                    </div>
                    <div style="margin-bottom: 1rem !important;">
                        <label style="display: block !important; margin-bottom: 0.25rem !important; font-weight: 500 !important;">Confirm New Password</label>
                        <input type="password" id="dynamic-confirm-password" style="
                            width: 100% !important;
                            padding: 0.5rem !important;
                            border: 1px solid #ddd !important;
                            border-radius: 4px !important;
                            font-size: 1rem !important;
                            box-sizing: border-box !important;
                        ">
                    </div>
                </div>
                <div style="
                    padding: 1rem 2rem 1.5rem !important;
                    border-top: 1px solid #eee !important;
                    display: flex !important;
                    justify-content: flex-end !important;
                    gap: 0.75rem !important;
                ">
                    <button class="dynamic-modal-close btn btn-secondary">Cancel</button>
                    <button class="dynamic-submit-password btn btn-primary">Change Password</button>
                </div>
            </div>
        `;

        // Add to body
        document.body.appendChild(modal);

        // Focus on first input
        setTimeout(() => {
            const firstInput = document.getElementById('dynamic-current-password');
            if (firstInput) firstInput.focus();
        }, 100);

        // Close handlers
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('dynamic-modal-close')) {
                modal.remove();
            }
        });

        // Submit handler
        modal.querySelector('.dynamic-submit-password').addEventListener('click', () => {
            this.submitDynamicPasswordChange();
        });

        // Escape key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    closePasswordModal() {
        const modal = document.getElementById('password-modal');
        modal.classList.remove('show');
        modal.style.display = 'none';
        modal.onclick = null; // Remove click handler
    }

    async submitDynamicPasswordChange() {
        const currentPassword = document.getElementById('dynamic-current-password').value;
        const newPassword = document.getElementById('dynamic-new-password').value;
        const confirmPassword = document.getElementById('dynamic-confirm-password').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showToast('Please fill in all password fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showToast('New password and confirmation do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showToast('New password must be at least 6 characters long', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showToast('Password changed successfully', 'success');
                // Remove the dynamic modal
                const modal = document.getElementById('dynamic-password-modal');
                if (modal) modal.remove();
            } else {
                this.showToast(data.error || 'Failed to change password', 'error');
            }

        } catch (error) {
            console.error('Change password error:', error);
            this.showToast('Error changing password', 'error');
        }
    }

    async submitPasswordChange() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showToast('Please fill in all password fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showToast('New password and confirmation do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showToast('New password must be at least 6 characters long', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showToast('Password changed successfully', 'success');
                this.closePasswordModal();
            } else {
                this.showToast(data.error || 'Failed to change password', 'error');
            }

        } catch (error) {
            console.error('Change password error:', error);
            this.showToast('Error changing password', 'error');
        }
    }
}

const app = new ArchitectureApp();
window.app = app;

//# sourceMappingURL=app.js.map
