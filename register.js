import { registerVenue } from "./utils.js";

function setupForm() {{
    const form = document.getElementById('venue-form');
    if (!form) {{
        console.error('Form with ID "venue-form" not found.');
        return;
    }}

    form.addEventListener('submit', function(event) {{
        event.preventDefault(); // Prevent the default form submission

        // Collecting form data
        const venueName = document.getElementById('venue-name').value;
        const cuisineType = document.getElementById('cuisine-type').value;
        const description = document.getElementById('description').value;
        const streetAddress = document.getElementById('street-address').value;
        const symbolAddress = document.getElementById('symbol-address').value;
        const publicKey = document.getElementById('pub-key').value;

        // Validation for the ";" character
        const fields = [venueName, cuisineType, description, streetAddress, symbolAddress];
        if (fields.some(field => field.includes(';'))) {
            alert('Input fields must not contain the ";" character.');
            return;
        }

        // Concatenate the form values with ";" as a delimiter
        const registrationData = fields.join(';');
        let uri = '';

        try {
            uri = registerVenue(symbolAddress, publicKey, registrationData);
        } catch (error) {
            alert('An error occurred while registering the venue. Please try again.');
            return; // Exit the function if an error occurred
        }

        // Open a new window and write the data to it
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(`<p>Registration Data: ${registrationData}</p><p>URI: <a href="${uri}">${uri}</a></p>`);
            newWindow.document.close(); // Close the document stream
        } else {
            console.log('Failed to open a new window. It may have been blocked.');
        }
    }});
}}

if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', setupForm);
}} else {{
    // DOMContentLoaded has already fired
    setupForm();
}}
