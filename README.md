# AutoLynk

Find Your Next Ride. A simple buy-and-sell marketplace for cars, built with
plain HTML, CSS and JavaScript. No build tools, no frameworks and no server.

## Opening the site

Double-click `index.html`. That is all it takes.

The first time it opens, the site loads three sample accounts and ten sample
cars so there is something to look at. After that it uses whatever is saved in
your browser, including the account you make yourself.

## Sample accounts

The password for all three is `password123`.

| Email | Name | Location | What they have |
| --- | --- | --- | --- |
| `juan@email.com` | Juan Dela Cruz | Tarlac City | Sells the Vios, Mirage, Navara, Accent and Innova |
| `maria@email.com` | Maria Santos | Quezon City | Sells the Civic, Ranger, Fortuner, Brio and Xpander |
| `pedro@email.com` | Pedro Reyes | Makati City | A buyer, with two saved cars and two conversations |

To see two sides of the same chat, log in as Pedro, open a conversation, send a
message, log out, then log back in as Juan and open Chat.

## Files

```
AutoLynk/
├── index.html          Home page: hero, search, featured cars
├── browse.html         All listings with search and filters
├── car-details.html    One car: photos, specs, description, owner
├── sell.html           Form for posting or editing a car
├── chat.html           Messages between a buyer and an owner
├── account.html        Profile, my listings, saved cars, my messages
├── login.html
├── register.html
├── css/
│   └── style.css       Every bit of styling on the site
├── js/
│   └── script.js       Accounts, listings, saved cars, chat, forms
└── images/
    └── cars/           Car photos (see images/README.md)
```

Every page links the same stylesheet and the same script:

```html
<link rel="stylesheet" href="css/style.css">
<script src="js/script.js"></script>
```

No page has a `<style>` block or a `style="..."` attribute, and no page has
JavaScript written inside it. HTML holds the structure, CSS holds the look and
JavaScript holds the behaviour.

## Changing the colours

Only two colours are used: dark navy `#17233C` and white. Everything else is a
lighter or darker shade of that navy. They are all set once at the top of
`css/style.css`:

```css
:root {
  --navy: #17233C;
  --white: #FFFFFF;
  ...
}
```

Change a value there and it updates across every page.

## How accounts and messages are stored

There is no database. Everything lives in the browser's `localStorage`, under
five names:

| Name | What is in it |
| --- | --- |
| `users` | Every account |
| `currentUser` | The id of whoever is logged in, for example `"user002"` |
| `cars` | Every car listing |
| `messages` | Every conversation, with its messages inside |
| `autolynkDemoLoaded` | A marker so the sample data is only added once |

An account looks like this:

```js
{
  id: "user001",              // never changes, not even when editing the profile
  name: "Juan Dela Cruz",
  email: "juan@email.com",
  password: "password123",
  location: "Tarlac City",
  profile: "",                // a picture, saved as a data URL
  created: 1749600000000,     // the date the account was made
  savedCars: ["car002"]       // the hearts this user pressed
}
```

A car listing carries the id of the person selling it:

```js
{
  id: "car001",
  ownerId: "user001",         // links the car back to an account
  brand: "Toyota",
  model: "Vios 1.3 XLE",
  year: "2022",
  price: 650000,
  location: "Tarlac City",
  status: "Active"            // "Sold" hides it from Browse
}
```

A conversation joins two people and one car:

```js
{
  conversationId: "conv001",
  carId: "car001",
  buyerId: "user003",
  sellerId: "user001",
  messages: [
    {
      messageId: "msg001",
      senderId: "user003",
      receiverId: "user001",
      message: "Is the car still available?",
      timestamp: 1749600000000
    }
  ]
}
```

Because each car knows its owner and each conversation knows its buyer, seller
and car, every page can show only the things that belong to whoever is logged
in.

## How the JavaScript is organised

`js/script.js` is split into fifteen numbered sections with comments. Section 02
is the only part that touches `localStorage`; everything else asks it through
small functions such as `getUsers()`, `saveCars()`, `findChat()` and
`getSavedFor()`.

That is on purpose. To move this project to a real database later, such as
Firebase or MySQL, only those functions in section 02 have to change. The pages
themselves would keep working.

The bottom of the file decides what to run by looking at the `id` on the
`<body>` tag, so `account.html` only runs the account code, `chat.html` only
runs the chat code, and so on.

## Pages that need an account

`account.html`, `chat.html` and `sell.html` need someone to be logged in. If
nobody is, the site sends you to `login.html` and shows *Please log in to
continue.* After you log in it takes you back to the page you wanted.

Logging out only clears `currentUser`. Accounts, listings, saved cars and
messages all stay where they are.

A conversation only opens for the two people in it, the buyer and the seller.
Typing someone else's conversation id into the address bar shows nothing, so
one account can never read another account's messages.

## Adding your own photos

The `images/cars` folder is empty, so each photo box shows the filename it is
waiting for. Drop a file in with that name and it appears.
`images/README.md` lists all of them.

Photos added through the Sell a Car form are not saved to that folder. They are
shrunk in the browser and stored with the listing, so they show up right away.

## Starting over

To wipe everything and get the sample data back, open the site, press F12 to
open the developer tools, go to the Console tab and run:

```js
localStorage.clear();
location.reload();
```

## A note on passwords

Passwords are stored as plain text because this is a school project with no
server behind it. Anyone who opens the developer tools can read them. A real
website must never do this — it would hash passwords on a server instead.
