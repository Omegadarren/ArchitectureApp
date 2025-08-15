// Validation utilities for API requests
const validator = {
    // Email validation
    isValidEmail(email) {
        if (!email) return true; // Optional field
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Phone validation (allows various formats)
    isValidPhone(phone) {
        if (!phone) return true; // Optional field
        const phoneRegex = /^[\d\s\-\(\)\+\.]{10,}$/;
        return phoneRegex.test(phone);
    },

    // Required field validation
    isRequired(value) {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    },

    // Number validation
    isValidNumber(value) {
        if (!value) return true; // Optional field
        return !isNaN(parseFloat(value)) && isFinite(value);
    },

    // Date validation
    isValidDate(dateString) {
        if (!dateString) return true; // Optional field
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime());
    },

    // ZIP code validation (US format)
    isValidZip(zip) {
        if (!zip) return true; // Optional field
        const zipRegex = /^\d{5}(-\d{4})?$/;
        return zipRegex.test(zip);
    },

    // Validate customer data
    validateCustomer(customerData) {
        const errors = [];

        if (!this.isRequired(customerData.CompanyName)) {
            errors.push('Company name is required');
        }

        if (customerData.Email && !this.isValidEmail(customerData.Email)) {
            errors.push('Invalid email format');
        }

        if (customerData.Email2 && !this.isValidEmail(customerData.Email2)) {
            errors.push('Invalid secondary email format');
        }

        if (customerData.Phone && !this.isValidPhone(customerData.Phone)) {
            errors.push('Invalid phone number format');
        }

        if (customerData.Phone2 && !this.isValidPhone(customerData.Phone2)) {
            errors.push('Invalid secondary phone number format');
        }

        if (customerData.ZipCode && !this.isValidZip(customerData.ZipCode)) {
            errors.push('Invalid ZIP code format');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },

    // Validate project data
    validateProject(projectData) {
        const errors = [];

        if (!this.isRequired(projectData.ProjectName)) {
            errors.push('Project name is required');
        }

        if (!this.isRequired(projectData.CustomerID)) {
            errors.push('Customer ID is required');
        }

        if (projectData.StartDate && !this.isValidDate(projectData.StartDate)) {
            errors.push('Invalid start date format');
        }

        if (projectData.EstimatedCompletionDate && !this.isValidDate(projectData.EstimatedCompletionDate)) {
            errors.push('Invalid estimated completion date format');
        }

        if (projectData.TotalContractAmount && !this.isValidNumber(projectData.TotalContractAmount)) {
            errors.push('Invalid contract amount format');
        }

        // Validate that end date is after start date
        if (projectData.StartDate && projectData.EstimatedCompletionDate) {
            const startDate = new Date(projectData.StartDate);
            const endDate = new Date(projectData.EstimatedCompletionDate);
            if (endDate <= startDate) {
                errors.push('Estimated completion date must be after start date');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },

    // Sanitize input (remove potentially harmful characters)
    sanitizeInput(input) {
        if (!input) return input;
        return input.toString().trim().replace(/<script.*?<\/script>/gi, '').replace(/<.*?>/gi, '');
    }
};

module.exports = validator;
