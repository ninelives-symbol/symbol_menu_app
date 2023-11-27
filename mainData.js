import { hexToUtf8 } from './utils.js';
import { fetchMosaicData } from './mosaicData.js';

// Get the Symbol address from the URL parameter
const urlParams = new URLSearchParams(window.location.search);
const symbol_address = urlParams.get('address');
console.log("Parsed Symbol address:", symbol_address);

if (!symbol_address) {

} else {
    // Fetch the menu data for the given Symbol address
    console.log("Fetching Mosaic Data for:", symbol_address);
    const venue_name = urlParams.get('name') || symbol_address;
    fetchMosaicData(symbol_address, venue_name, true);
}

export async function fetchAllVenues() {
    try {
        const response = await fetch("http://mikun-testnet.tk:3000/metadata?targetAddress=TDOXHWCILFG7XRZ5CASLOLC4RKOMRF7D2EQOTXQ");  // Endpoint to fetch all venues
        const json = await response.json();

        // Extracting data
        const hexValues = json.data ? json.data.map(entry => entry.metadataEntry.value) : [];

        // Displaying the hex and parsed values
        for (let hexValue of hexValues) {
            const asciiValue = hexToUtf8(hexValue);
            const [title, cuisine, description, address, symbol_address] = asciiValue.split(';');

            // Displaying the parsed data on the webpage
            displayData(title, cuisine, description, address, symbol_address);
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

export function displayData(venue_name, cuisine, description, address, symbol_address) {
    let contentDiv = document.getElementById("content");
    let boxDiv = document.createElement("div");
    boxDiv.className = "box";

    let titleDiv = document.createElement("div");
    titleDiv.className = "box-title";
    let link = document.createElement("a");
    link.href = "#";
    link.addEventListener("click", (event) => {
        event.preventDefault();
        // Navigate to the venue page with the address and name as URL parameters
        window.location.href = `index.html?address=${symbol_address}&name=${venue_name}`;
    });
    link.innerText = venue_name;
    titleDiv.appendChild(link);

    let cuisineDiv = document.createElement("div");
    cuisineDiv.innerText = "Cuisine: " + cuisine;

    let descriptionDiv = document.createElement("div");
    descriptionDiv.innerText = "Description: " + description;

    let addressDiv = document.createElement("div");
    addressDiv.innerText = "Address: " + address;
        
    let symbolAddressDiv = document.createElement("div");
    symbolAddressDiv.innerHTML = 'Symbol Address: <a href="https://testnet.symbol.fyi/accounts/' + symbol_address + '" target="_blank">' + symbol_address + '</a>';

    boxDiv.appendChild(titleDiv);
    boxDiv.appendChild(cuisineDiv);
    boxDiv.appendChild(descriptionDiv);
    boxDiv.appendChild(addressDiv);
    boxDiv.appendChild(symbolAddressDiv);
        
    contentDiv.appendChild(boxDiv);
}
