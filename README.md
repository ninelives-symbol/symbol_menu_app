# symbol_menu_app

Simple prototype menu and ordering app that utilises the Symbol blockchain. New venues can register their business by writing metadata to a central account (the transaction must be signed by the account owner to be approved). This could form a record of all registered businesses or could be used to aggregate restaurants that are on the same physical site. For example, a venue that hosts different retailers, restaurants or food trucks would have their restaurants displayed on the same webpage so that customers can view all offerings and place orders with any of the venues.

The app allows venues to add and remove menu items and to update metadata (e.g. to change the item description or to update the price). They can also revise the amount of the item that they have in stock. All changes are bundled together into a single aggregate transaction. 

Finally, the user can order items from the menu and pay in XYM. They select which items they want to order along with the quantity required. The price is then calculated and the transaction is created. Clicking on the URI will submit the transaction. The venue will receive the order which includes a message with the customer's table number and the order details along with the payment. If the venue accepts and signs the transaction then the mosaic supply for all items ordered will be decremented by the number of each item ordered.

# Example customer order

https://github.com/ninelives-symbol/symbol_menu_app/assets/142909712/9c1c72fd-af2e-4f2a-be93-906aa4966c7e

# Demo

Browse menus: http://xymharvesting.net/menu/

Ordering: http://xymharvesting.net/menu/index.html?address=TDLV5CV3XTOYQGKBZZEJPEU3CTHCF2C7WCGENII&name=Fry%20Me%20a%20River

Venue registration: http://xymharvesting.net/menu/register.html

Inventory modification: http://xymharvesting.net/menu/inventory.html?address=TDLV5CV3XTOYQGKBZZEJPEU3CTHCF2C7WCGENII
