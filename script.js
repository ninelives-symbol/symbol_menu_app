// script.js
import { fetchAllVenues } from './mainData.js';
import { fetchMosaicData } from './mosaicData.js';

// Get the Symbol address and venue name from the URL parameters
const urlParams = new URLSearchParams(window.location.search);
const symbol_address = urlParams.get('address');
const venue_name = urlParams.get('name');

if (!symbol_address) {
    // No address provided, so fetch and display all venues
    fetchAllVenues();
} else {
    // Address provided. If a venue name is also provided, use it. Otherwise, use the address as the name.
    const displayVenueName = venue_name || symbol_address;

    // Fetch the menu data for the given Symbol address and display it
    fetchMosaicData(symbol_address, displayVenueName, true);
}
