/* ==========================================================================
   AutoLynk — script.js
   Everything the pages need: accounts, listings, saved cars and messages.

   HOW THE DATA IS STORED
   Everything lives in localStorage, so it survives a refresh. Each group of
   data has its own key and its own small set of functions. If you ever move
   to a real database (Firebase, MySQL), you only need to rewrite the
   functions in section 02 — the rest of the file can stay as it is.

   CONTENTS
   01. Little helpers            08. Home page
   02. Storage                   09. Browse page
   03. Demo data (first run)     10. Car details page
   04. Accounts and login        11. Sell a Car page
   05. Photos                    12. My Account page
   06. Saved (heart) buttons     13. Chat page
   07. Car cards                 14. Login and register pages
   ========================================================================== */


/* ==========================================================================
   01. LITTLE HELPERS
   ========================================================================== */

// Finds an element by its id. Returns null when the page does not have it.
function el(id) {
  return document.getElementById(id);
}

// Turns 650000 into "₱650,000"
function peso(amount) {
  return "₱" + Number(amount || 0).toLocaleString("en-US");
}

// Reads a value from the address bar, for example ?car=car001
function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

// "Juan Dela Cruz" becomes "JD" for the round avatars
function initials(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(function (word) { return word.charAt(0).toUpperCase(); })
    .join("");
}

// Makes text safe to drop into HTML (in case someone types < or > in a form)
function safe(text) {
  return String(text === null || text === undefined ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 7 becomes "007", used when building ids like user007
function pad3(number) {
  var text = String(number);

  while (text.length < 3) {
    text = "0" + text;
  }

  return text;
}

// Builds the next id in a list, for example user001 -> user002
function nextId(prefix, list, field) {
  var biggest = 0;

  list.forEach(function (item) {
    var number = parseInt(String(item[field]).replace(prefix, ""), 10);
    if (number > biggest) {
      biggest = number;
    }
  });

  return prefix + pad3(biggest + 1);
}

// "9:14 AM" — used on the message bubbles
function clockTime(stamp) {
  return new Date(stamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sameDay(first, second) {
  return first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();
}

// "Today", "Yesterday" or "Sep 5" — used on the conversation lists
function dayLabel(stamp) {
  var when = new Date(stamp);
  var today = new Date();
  var yesterday = new Date(today.getTime() - 86400000);

  if (sameDay(when, today)) {
    return "Today";
  }
  if (sameDay(when, yesterday)) {
    return "Yesterday";
  }
  return when.toLocaleDateString([], { month: "short", day: "numeric" });
}

// "5 September 2026" — used for the account creation date
function longDate(stamp) {
  return new Date(stamp).toLocaleDateString([], {
    year: "numeric", month: "long", day: "numeric"
  });
}


/* ==========================================================================
   02. STORAGE
   Every read and write to localStorage happens here. If storage is switched
   off in the browser, the values are kept in memory until the tab closes.

   NOTE: passwords are stored as plain text because this is a class project
   with no server. A real site must never do this.
   ========================================================================== */

var memory = {};

var store = {
  read: function (key, fallback) {
    if (key in memory) {
      return memory[key];
    }
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  },
  write: function (key, value) {
    memory[key] = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Storage is full or switched off. The value still lives in memory.
    }
  }
};

/* The five things the site keeps in the browser. Change a name here and it
   changes everywhere, because nothing else touches localStorage directly. */
var KEY = {
  users: "users",             // every registered account
  current: "currentUser",     // the id of whoever is logged in right now
  cars: "cars",               // every car listing
  messages: "messages",       // every conversation, with its messages inside
  seeded: "autolynkDemoLoaded" // remembers that the sample data was added
};

/* ----- Users ----- */

function getUsers() {
  return store.read(KEY.users, []);
}

function saveUsers(list) {
  store.write(KEY.users, list);
}

function findUser(id) {
  return getUsers().filter(function (user) { return user.id === id; })[0] || null;
}

function findUserByEmail(email) {
  var wanted = String(email || "").trim().toLowerCase();
  return getUsers().filter(function (user) {
    return user.email.toLowerCase() === wanted;
  })[0] || null;
}

/* ----- Cars ----- */

function getCars() {
  return store.read(KEY.cars, []);
}

function saveCars(list) {
  store.write(KEY.cars, list);
}

function findCar(id) {
  return getCars().filter(function (car) { return car.id === id; })[0] || null;
}

function carsOwnedBy(userId) {
  return getCars().filter(function (car) { return car.ownerId === userId; });
}

/* ----- Conversations ----- */

function getChats() {
  return store.read(KEY.messages, []);
}

function saveChats(list) {
  store.write(KEY.messages, list);
}

function findChat(id) {
  return getChats().filter(function (chat) { return chat.conversationId === id; })[0] || null;
}

// Is this person the buyer or the seller in this conversation?
function isInChat(chat, userId) {
  return Boolean(chat) && (chat.buyerId === userId || chat.sellerId === userId);
}

/* Finds a conversation, but only when the logged-in person is part of it.
   This is what stops someone from reading another person's messages by
   typing a conversation id into the address bar. */
function findMyChat(id, userId) {
  var chat = findChat(id);
  return isInChat(chat, userId) ? chat : null;
}

// Every conversation the user takes part in, newest reply first
function chatsFor(userId) {
  return getChats()
    .filter(function (chat) {
      return chat.buyerId === userId || chat.sellerId === userId;
    })
    .sort(function (a, b) {
      return lastMessageTime(b) - lastMessageTime(a);
    });
}

function lastMessage(chat) {
  return chat.messages[chat.messages.length - 1] || null;
}

function lastMessageTime(chat) {
  var message = lastMessage(chat);
  return message ? message.timestamp : 0;
}

// The other person in a conversation
function otherPersonId(chat, userId) {
  return chat.buyerId === userId ? chat.sellerId : chat.buyerId;
}

/* ----- Saved cars -----
   The list of saved car ids is kept on the account itself, so every user
   automatically has their own hearts. */

function getSavedFor(userId) {
  var user = findUser(userId);
  return user && user.savedCars ? user.savedCars : [];
}

function setSavedFor(userId, list) {
  var users = getUsers();

  users.forEach(function (user) {
    if (user.id === userId) {
      user.savedCars = list;
    }
  });

  saveUsers(users);
}


/* ==========================================================================
   03. DEMO DATA
   Loaded once, the first time the site is opened on this browser. After
   that the site uses whatever is in storage, including your own account.
   ========================================================================== */

function seedDemoData() {
  if (store.read(KEY.seeded, false)) {
    return;
  }

  var today = new Date();
  var joined = new Date(today.getFullYear(), today.getMonth() - 4, 12).getTime();

  saveUsers([
    {
      id: "user001", name: "Juan Dela Cruz", email: "juan@email.com",
      password: "password123", location: "Tarlac City", profile: "",
      created: joined, savedCars: []
    },
    {
      id: "user002", name: "Maria Santos", email: "maria@email.com",
      password: "password123", location: "Quezon City", profile: "",
      created: joined, savedCars: []
    },
    {
      id: "user003", name: "Pedro Reyes", email: "pedro@email.com",
      password: "password123", location: "Makati City", profile: "",
      created: joined, savedCars: ["car001", "car007"]
    }
  ]);

  saveCars([
    {
      id: "car001", ownerId: "user001", status: "Active", created: joined,
      brand: "Toyota", model: "Vios 1.3 XLE", name: "Toyota Vios 1.3 XLE",
      year: "2022", price: 650000, mileage: "32,000 km", transmission: "Automatic",
      fuel: "Gasoline", engine: "1.3L 4-cylinder", location: "Tarlac City",
      photo: "toyota-vios-2022.jpg", photos: [],
      description: "Well-maintained Toyota Vios in good condition. Regularly serviced and ready for its next owner. Complete papers, registration is current, and the casa records are available on request.",
      features: ["Backup camera", "Touchscreen audio", "Dual airbags", "ABS brakes", "Keyless entry", "Alloy wheels"]
    },
    {
      id: "car002", ownerId: "user002", status: "Active", created: joined,
      brand: "Honda", model: "Civic 1.8 E", name: "Honda Civic 1.8 E",
      year: "2021", price: 1050000, mileage: "24,500 km", transmission: "Automatic",
      fuel: "Gasoline", engine: "1.8L 4-cylinder", location: "Quezon City",
      photo: "honda-civic-2021.jpg", photos: [],
      description: "Casa maintained since new with all service records on hand. Second owner, no accident history, and the tyres were replaced last year.",
      features: ["Cruise control", "Push start", "Leather seats", "Rear sensors", "Apple CarPlay", "LED headlights"]
    },
    {
      id: "car003", ownerId: "user001", status: "Active", created: joined,
      brand: "Mitsubishi", model: "Mirage G4 GLX", name: "Mitsubishi Mirage G4 GLX",
      year: "2020", price: 480000, mileage: "41,000 km", transmission: "Manual",
      fuel: "Gasoline", engine: "1.2L 3-cylinder", location: "Angeles City",
      photo: "mitsubishi-mirage-2020.jpg", photos: [],
      description: "Light on fuel and easy to park, a good first car. Clean interior, aircon is cold, and the registration is updated until next year.",
      features: ["Fuel efficient", "Bluetooth audio", "Power windows", "Dual airbags", "Fresh aircon"]
    },
    {
      id: "car004", ownerId: "user002", status: "Active", created: joined,
      brand: "Ford", model: "Ranger XLS 4x2", name: "Ford Ranger XLS 4x2",
      year: "2023", price: 1350000, mileage: "18,000 km", transmission: "Automatic",
      fuel: "Diesel", engine: "2.0L turbo diesel", location: "Cebu City",
      photo: "ford-ranger-2023.jpg", photos: [],
      description: "Almost new pickup, still under warranty until March 2027. Used for weekend trips only, with a bed liner and tint already installed.",
      features: ["Still under warranty", "Bed liner", "Reverse camera", "Tow bar", "Hill start assist", "Digital dashboard"]
    },
    {
      id: "car005", ownerId: "user001", status: "Active", created: joined,
      brand: "Nissan", model: "Navara EL Calibre", name: "Nissan Navara EL Calibre",
      year: "2021", price: 1180000, mileage: "36,800 km", transmission: "Automatic",
      fuel: "Diesel", engine: "2.5L turbo diesel", location: "Davao City",
      photo: "nissan-navara-2021.jpg", photos: [],
      description: "Strong and quiet on the highway. Serviced every 5,000 km at the dealership, with the receipts kept in the glove box.",
      features: ["Roll bar", "Side steps", "Reverse camera", "Cruise control", "Cooled glove box"]
    },
    {
      id: "car006", ownerId: "user001", status: "Active", created: joined,
      brand: "Hyundai", model: "Accent 1.4 GL", name: "Hyundai Accent 1.4 GL",
      year: "2019", price: 520000, mileage: "58,000 km", transmission: "Manual",
      fuel: "Gasoline", engine: "1.4L 4-cylinder", location: "San Fernando",
      photo: "hyundai-accent-2019.jpg", photos: [],
      description: "Reliable daily sedan with a roomy trunk. Brakes and battery are new, and the body has no dents.",
      features: ["New battery", "New brake pads", "Bluetooth audio", "Power steering", "Spare tyre included"]
    },
    {
      id: "car007", ownerId: "user002", status: "Active", created: joined,
      brand: "Toyota", model: "Fortuner 2.4 G", name: "Toyota Fortuner 2.4 G",
      year: "2020", price: 1480000, mileage: "62,000 km", transmission: "Automatic",
      fuel: "Diesel", engine: "2.4L turbo diesel", location: "Makati City",
      photo: "toyota-fortuner-2020.jpg", photos: [],
      description: "Family SUV with seven seats and plenty of space for long drives. Casa maintained, and the third row has barely been used.",
      features: ["Seven seats", "Reverse camera", "Roof rails", "Leather seats", "Climate control", "Alloy wheels"]
    },
    {
      id: "car008", ownerId: "user002", status: "Active", created: joined,
      brand: "Honda", model: "Brio RS", name: "Honda Brio RS",
      year: "2022", price: 690000, mileage: "21,400 km", transmission: "Automatic",
      fuel: "Gasoline", engine: "1.2L 4-cylinder", location: "Bacolod City",
      photo: "honda-brio-2022.jpg", photos: [],
      description: "Low mileage hatchback that is easy on fuel in city traffic. Garage kept and never flooded.",
      features: ["Touchscreen audio", "Reverse camera", "Keyless entry", "Fog lamps", "Fuel efficient"]
    },
    {
      id: "car009", ownerId: "user002", status: "Active", created: joined,
      brand: "Mitsubishi", model: "Xpander GLS", name: "Mitsubishi Xpander GLS",
      year: "2021", price: 890000, mileage: "39,200 km", transmission: "Automatic",
      fuel: "Gasoline", engine: "1.5L 4-cylinder", location: "Iloilo City",
      photo: "mitsubishi-xpander-2021.jpg", photos: [],
      description: "Seven seater MPV with a high ground clearance, handy during the rainy season. Complete papers and ready for transfer.",
      features: ["Seven seats", "High ground clearance", "Reverse camera", "Roof rails", "Foldable rear seats"]
    },
    {
      id: "car010", ownerId: "user001", status: "Sold", created: joined,
      brand: "Toyota", model: "Innova 2.8 E", name: "Toyota Innova 2.8 E",
      year: "2018", price: 890000, mileage: "78,000 km", transmission: "Manual",
      fuel: "Diesel", engine: "2.8L turbo diesel", location: "Tarlac City",
      photo: "toyota-innova-2018.jpg", photos: [],
      description: "Sold last month. Kept here so you can see how a finished listing looks in My Listings.",
      features: ["Eight seats", "Tinted windows", "Roof rails"]
    }
  ]);

  // Two conversations so the chat page has something to show
  var morning = new Date();
  morning.setHours(9, 14, 0, 0);

  var yesterday = new Date(morning.getTime() - 86400000);

  saveChats([
    {
      conversationId: "conv001", carId: "car001", buyerId: "user003", sellerId: "user001",
      messages: [
        {
          messageId: "msg001", senderId: "user003", receiverId: "user001",
          message: "Is the car still available?", timestamp: morning.getTime()
        },
        {
          messageId: "msg002", senderId: "user001", receiverId: "user003",
          message: "Yes, it is still available.", timestamp: morning.getTime() + 420000
        },
        {
          messageId: "msg003", senderId: "user003", receiverId: "user001",
          message: "Can I see the car this weekend?", timestamp: morning.getTime() + 540000
        },
        {
          messageId: "msg004", senderId: "user001", receiverId: "user003",
          message: "Saturday afternoon works for me. I am near the city plaza.",
          timestamp: morning.getTime() + 960000
        }
      ]
    },
    {
      conversationId: "conv002", carId: "car002", buyerId: "user003", sellerId: "user002",
      messages: [
        {
          messageId: "msg001", senderId: "user003", receiverId: "user002",
          message: "Good morning! Is the Civic still on the market?",
          timestamp: yesterday.getTime()
        },
        {
          messageId: "msg002", senderId: "user002", receiverId: "user003",
          message: "Yes it is. Casa maintained since new, I have all the records.",
          timestamp: yesterday.getTime() + 600000
        },
        {
          messageId: "msg003", senderId: "user003", receiverId: "user002",
          message: "Can I see the car tomorrow?", timestamp: yesterday.getTime() + 900000
        }
      ]
    }
  ]);

  // Pedro has already saved a couple of cars (see his savedCars list above)
  store.write(KEY.seeded, true);
}


/* ==========================================================================
   04. ACCOUNTS AND LOGIN
   ========================================================================== */

function currentUserId() {
  return store.read(KEY.current, "");
}

function currentUser() {
  var id = currentUserId();
  return id ? findUser(id) : null;
}

function loginAs(user) {
  store.write(KEY.current, user.id);
}

function logout() {
  // Only the login session is cleared. Accounts, cars and messages stay.
  store.write(KEY.current, "");
}

// These pages need an account. Everyone else is sent to the login page.
var PRIVATE_PAGES = ["page-account", "page-chat", "page-sell"];

function guardPage() {
  var page = document.body.id;

  if (PRIVATE_PAGES.indexOf(page) === -1 || currentUser()) {
    return true;
  }

  var here = window.location.pathname.split("/").pop() + window.location.search;
  window.location.replace("login.html?next=" + encodeURIComponent(here));
  return false;
}

// Puts a picture or the initials inside a round avatar
function paintAvatar(box, user) {
  if (!box) {
    return;
  }

  if (user && user.profile) {
    box.innerHTML = '<img class="avatar-img" src="' + safe(user.profile) + '" alt="">';
  } else {
    box.textContent = initials(user ? user.name : "?");
  }
}

// The Login link in the menu becomes Log out once you are signed in
function paintNav() {
  var user = currentUser();

  document.querySelectorAll("[data-auth-login]").forEach(function (link) {
    if (user) {
      link.textContent = "Log out";
      link.href = "index.html";
      link.setAttribute("data-auth-logout", "true");
    } else {
      link.textContent = "Login";
      link.href = "login.html";
      link.removeAttribute("data-auth-logout");
    }
  });
}

document.addEventListener("click", function (event) {
  var link = event.target.closest("[data-auth-logout]");
  if (!link) {
    return;
  }

  event.preventDefault();
  logout();
  window.location.href = "index.html";
});


/* ==========================================================================
   05. PHOTOS
   The images folder starts empty. When a photo file is missing we hide the
   broken image so the grey box shows the filename it is waiting for.
   ========================================================================== */

/* Makes a big camera photo smaller before it is stored. A phone photo can be
   several megabytes, and the browser only gives this site about five, so the
   picture is redrawn at most 900 pixels wide and saved as a lighter JPEG. */
function shrinkPhoto(file, done) {
  var reader = new FileReader();

  reader.onload = function () {
    var image = new Image();

    image.onload = function () {
      var maxWidth = 900;
      var scale = Math.min(1, maxWidth / image.width);
      var canvas = document.createElement("canvas");

      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      done(canvas.toDataURL("image/jpeg", 0.72));
    };

    // If the browser cannot read it as a picture, keep the file as it is
    image.onerror = function () { done(reader.result); };
    image.src = reader.result;
  };

  reader.readAsDataURL(file);
}

function watchPhotos(area) {
  var photos = (area || document).querySelectorAll(".photo-img");

  photos.forEach(function (img) {
    img.addEventListener("error", function () {
      img.classList.add("is-hidden");
    });

    if (img.complete && img.naturalWidth === 0) {
      img.classList.add("is-hidden");
    }
  });
}

// Works out which photo a card or page should show
function coverPhoto(car) {
  if (car.photos && car.photos.length) {
    return { src: car.photos[0], label: "Owner photo" };
  }
  if (car.photo) {
    return { src: "images/cars/" + car.photo, label: car.photo };
  }
  return { src: "", label: "No photo added" };
}

// Puts one photo (or its placeholder) into a photo box
function fillPhoto(frame, source, label) {
  var image = frame.querySelector(".photo-img");
  frame.dataset.file = label;

  if (!source) {
    image.removeAttribute("src");
    image.classList.add("is-hidden");
    return;
  }

  // Only reload when the photo is actually a different one
  if (image.getAttribute("src") !== source) {
    image.classList.remove("is-hidden");
    image.src = source;
  }
}


/* ==========================================================================
   06. SAVED (HEART) BUTTONS
   Saved cars belong to the logged-in user, so everyone has their own list.
   ========================================================================== */

function mySavedCars() {
  var user = currentUser();
  return user ? getSavedFor(user.id) : [];
}

function toggleSavedCar(carId) {
  var user = currentUser();

  if (!user) {
    window.location.href = "login.html?next=" + encodeURIComponent(
      window.location.pathname.split("/").pop() + window.location.search
    );
    return;
  }

  var saved = getSavedFor(user.id);

  if (saved.indexOf(carId) > -1) {
    saved = saved.filter(function (item) { return item !== carId; });
  } else {
    saved = saved.concat(carId);
  }

  setSavedFor(user.id, saved);
  paintSaveButtons();

  // On My Account, unhearting a car should remove its card right away
  if (document.body.id === "page-account") {
    paintSavedCars(user);
  }
}

function paintSaveButtons() {
  var saved = mySavedCars();

  document.querySelectorAll("[data-save]").forEach(function (button) {
    var isSaved = saved.indexOf(button.dataset.save) > -1;
    button.classList.toggle("is-saved", isSaved);
    button.setAttribute("aria-pressed", isSaved ? "true" : "false");

    // The wide button on the car details page shows words instead of a heart
    if (button.id === "detailSave") {
      button.textContent = isSaved ? "Saved" : "Save this car";
    }
  });
}

// One listener handles every heart on the page, even cards added later
document.addEventListener("click", function (event) {
  var button = event.target.closest("[data-save]");
  if (!button) {
    return;
  }

  event.preventDefault();
  toggleSavedCar(button.dataset.save);
});


/* ==========================================================================
   07. CAR CARDS
   One function builds every car card on the site.
   ========================================================================== */

function cardHtml(car, showRemove) {
  var cover = coverPhoto(car);
  var link = "car-details.html?car=" + encodeURIComponent(car.id);
  var title = car.name + " " + car.year;

  var actions = '<a class="btn btn--outline btn--small btn--full" href="' + link + '">View Details</a>';

  if (showRemove) {
    actions = actions +
      '<button class="btn btn--outline btn--small btn--full" type="button" data-unsave="' +
      safe(car.id) + '">Remove from saved</button>';
  }

  return '<article class="car-card"' +
      ' data-name="' + safe(title) + '"' +
      ' data-brand="' + safe(car.brand) + '"' +
      ' data-price="' + safe(car.price) + '"' +
      ' data-year="' + safe(car.year) + '"' +
      ' data-transmission="' + safe(car.transmission) + '"' +
      ' data-location="' + safe(car.location) + '">' +
      '<a class="car-card-link" href="' + link + '" aria-label="View ' + safe(title) + '"></a>' +
      '<div class="photo-frame photo-frame--card" data-file="' + safe(cover.label) + '">' +
        '<img class="photo-img" src="' + safe(cover.src) + '" alt="' + safe(title) + '">' +
      '</div>' +
      '<button class="save-btn" type="button" data-save="' + safe(car.id) + '"' +
        ' aria-pressed="false" aria-label="Save ' + safe(title) + '"></button>' +
      '<div class="car-body">' +
        '<h3 class="car-name">' + safe(car.name) + '</h3>' +
        '<p class="car-year">' + safe(car.year) + '</p>' +
        '<ul class="car-meta"><li>' + safe(car.mileage) + '</li><li>' + safe(car.transmission) + '</li></ul>' +
        '<p class="car-price">' + peso(car.price) + '</p>' +
        '<p class="car-place">' + safe(car.location) + '</p>' +
        '<div class="car-actions">' + actions + '</div>' +
      '</div>' +
    '</article>';
}

// Cars anyone can browse: everything that has not been marked as sold
function carsForSale() {
  return getCars().filter(function (car) { return car.status !== "Sold"; });
}


/* ==========================================================================
   08. HOME PAGE
   ========================================================================== */

function initHome() {
  var grid = el("featuredGrid");
  if (!grid) {
    return;
  }

  var featured = carsForSale().slice(0, 4);

  grid.innerHTML = featured.map(function (car) {
    return cardHtml(car);
  }).join("");

  watchPhotos(grid);
  paintSaveButtons();
}


/* ==========================================================================
   09. BROWSE PAGE — search and filters
   ========================================================================== */

function initBrowse() {
  var grid = el("carGrid");
  if (!grid) {
    return;
  }

  var filterSearch = el("filterSearch");
  var filterBrand = el("filterBrand");
  var filterPrice = el("filterPrice");
  var filterYear = el("filterYear");
  var filterTransmission = el("filterTransmission");
  var filterLocation = el("filterLocation");
  var resultCount = el("resultCount");
  var emptyState = el("emptyState");
  var cars = carsForSale();

  grid.innerHTML = cars.map(function (car) {
    return cardHtml(car);
  }).join("");

  watchPhotos(grid);
  paintSaveButtons();

  // Adds any brand, year or city that is missing from a dropdown, so cars
  // posted by owners can be filtered too
  function addOptions(select, values) {
    var existing = Array.from(select.options).map(function (option) {
      return option.value;
    });

    values.filter(function (value, index) {
      return value && existing.indexOf(value) === -1 && values.indexOf(value) === index;
    }).sort().forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  addOptions(filterBrand, cars.map(function (car) { return car.brand; }));
  addOptions(filterLocation, cars.map(function (car) { return car.location; }));
  addOptions(filterYear, cars.map(function (car) { return String(car.year); }));

  function applyFilters() {
    var words = filterSearch.value.trim().toLowerCase();
    var brand = filterBrand.value;
    var maxPrice = Number(filterPrice.value || 0);
    var year = filterYear.value;
    var gearbox = filterTransmission.value;
    var place = filterLocation.value;
    var shown = 0;

    grid.querySelectorAll(".car-card").forEach(function (card) {
      var car = card.dataset;
      var show = true;

      // The search box looks at the car name and the city
      if (words && (car.name + " " + car.location).toLowerCase().indexOf(words) === -1) { show = false; }
      if (brand && car.brand !== brand) { show = false; }
      if (maxPrice && Number(car.price) > maxPrice) { show = false; }
      if (year && car.year !== year) { show = false; }
      if (gearbox && car.transmission !== gearbox) { show = false; }
      if (place && car.location.indexOf(place) === -1) { show = false; }

      card.classList.toggle("is-hidden", !show);
      if (show) { shown = shown + 1; }
    });

    resultCount.textContent = shown === 1 ? "Showing 1 car" : "Showing " + shown + " cars";
    emptyState.classList.toggle("is-hidden", shown > 0);
  }

  // Fills the filters from the home page search, for example browse.html?q=vios
  var askedKeyword = getQuery("q");
  var askedPrice = getQuery("price");
  var askedPlace = getQuery("location").trim();
  var askedLocation = askedPlace.toLowerCase();

  if (askedKeyword) { filterSearch.value = askedKeyword; }
  if (askedPrice) { filterPrice.value = askedPrice; }

  if (askedLocation) {
    // Picks the first city in the dropdown that matches what was typed
    var match = Array.from(filterLocation.options).filter(function (option) {
      return option.value && option.value.toLowerCase().indexOf(askedLocation) > -1;
    })[0];

    if (match) {
      filterLocation.value = match.value;
    } else {
      // No city matches, so search for the words instead of ignoring them
      filterSearch.value = (filterSearch.value + " " + askedPlace).trim();
    }
  }

  [filterSearch, filterBrand, filterPrice, filterYear, filterTransmission, filterLocation]
    .forEach(function (control) {
      control.addEventListener("input", applyFilters);
      control.addEventListener("change", applyFilters);
    });

  el("clearFilters").addEventListener("click", function () {
    filterSearch.value = "";
    filterBrand.value = "";
    filterPrice.value = "";
    filterYear.value = "";
    filterTransmission.value = "";
    filterLocation.value = "";
    applyFilters();
  });

  applyFilters();
}


/* ==========================================================================
   10. CAR DETAILS PAGE
   The car id comes from the address bar, for example car-details.html?car=car001
   ========================================================================== */

function initDetails() {
  var carId = getQuery("car");
  var car = findCar(carId);
  var grid = el("detailGrid");

  if (!car) {
    grid.classList.add("is-hidden");
    el("notFound").classList.remove("is-hidden");
    el("breadcrumbName").textContent = "Car not found";
    document.title = "Car not found — AutoLynk";
    return;
  }

  var me = currentUser();
  var owner = findUser(car.ownerId);
  var isMyListing = me && me.id === car.ownerId;
  var fullName = car.name + " " + car.year;

  document.title = fullName + " — AutoLynk";
  el("breadcrumbName").textContent = fullName;
  el("detailName").textContent = fullName;
  el("detailPlace").textContent = car.location;
  el("detailPrice").textContent = peso(car.price);

  el("specYear").textContent = car.year;
  el("specMileage").textContent = car.mileage;
  el("specTransmission").textContent = car.transmission;
  el("specFuel").textContent = car.fuel;
  el("specEngine").textContent = car.engine;
  el("specLocation").textContent = car.location;
  el("detailDescription").textContent = car.description;

  var cover = coverPhoto(car);
  fillPhoto(el("mainPhotoFrame"), cover.src, cover.label);
  el("mainPhoto").alt = fullName;

  // The three smaller photos below the main one
  var extraPhotos = [];

  if (car.photos && car.photos.length > 1) {
    extraPhotos = car.photos.slice(1);
  } else if (car.photo) {
    extraPhotos = [
      car.photo.replace(".jpg", "-2.jpg"),
      car.photo.replace(".jpg", "-3.jpg"),
      car.photo.replace(".jpg", "-4.jpg")
    ];
  }

  el("thumbs").querySelectorAll(".photo-frame").forEach(function (frame, index) {
    var item = extraPhotos[index];

    if (!item) {
      frame.classList.add("is-hidden");
      return;
    }

    frame.classList.remove("is-hidden");

    if (item.indexOf("data:") === 0) {
      fillPhoto(frame, item, "Owner photo");
    } else {
      fillPhoto(frame, "images/cars/" + item, item);
    }
  });

  // Features. Cars posted through the form do not have any yet.
  var featureList = el("detailFeatures");

  if (car.features && car.features.length) {
    featureList.innerHTML = car.features.map(function (feature) {
      return "<li>" + safe(feature) + "</li>";
    }).join("");
  } else {
    featureList.closest(".detail-block").classList.add("is-hidden");
  }

  // Owner box. The name and city come from the owner's stored account.
  var ownerName = owner ? owner.name : "Owner account removed";
  paintAvatar(el("ownerAvatar"), owner);
  el("ownerName").textContent = ownerName;

  if (isMyListing) {
    el("ownerPlace").textContent = "This is your listing";
    el("chatLink").textContent = "Edit listing";
    el("chatLink").href = "sell.html?edit=" + encodeURIComponent(car.id);
  } else {
    el("ownerPlace").textContent = owner ? owner.location : "";
    el("chatLink").href = "chat.html?car=" + encodeURIComponent(car.id);
  }

  // Tells the heart button which car this page is about
  el("detailSave").dataset.save = car.id;
  paintSaveButtons();
  watchPhotos();
}


/* ==========================================================================
   11. SELL A CAR PAGE
   The same form posts a new car and edits one you already own.
   ========================================================================== */

function initSell() {
  var form = el("sellForm");
  if (!form) {
    return;
  }

  var me = currentUser();
  var photoInput = el("sellPhotos");
  var previews = el("photoPreviews");
  var message = el("sellMessage");
  var chosenPhotos = [];
  var photosLoading = 0;

  // Are we editing one of my listings?
  var editId = getQuery("edit");
  var editing = editId ? findCar(editId) : null;

  // Only the owner may edit a listing
  if (editing && editing.ownerId !== me.id) {
    editing = null;
  }

  // The link asked to edit something that is missing or belongs to someone
  // else, so this becomes a new post. Say so instead of quietly switching.
  if (editId && !editing) {
    message.textContent = "That listing cannot be edited, so this is a new post.";
    message.classList.remove("is-hidden");
  }

  if (editing) {
    el("sellTitle").textContent = "Edit listing";
    el("sellSub").textContent = "Update your details and save the changes.";
    el("sellSubmit").textContent = "Save changes";
    document.title = "Edit listing — AutoLynk";

    el("sellBrand").value = editing.brand;
    el("sellModel").value = editing.model;
    el("sellYear").value = editing.year;
    el("sellPrice").value = editing.price;
    el("sellMileage").value = String(editing.mileage).replace(/[^0-9]/g, "");
    el("sellTransmission").value = editing.transmission;
    el("sellFuel").value = editing.fuel;
    el("sellLocation").value = editing.location;
    el("sellDescription").value = editing.description;

    chosenPhotos = (editing.photos || []).slice();
    showPreviews();
  }

  function showPreviews() {
    previews.innerHTML = "";

    chosenPhotos.forEach(function (dataUrl) {
      if (!dataUrl) {
        return;
      }
      var image = document.createElement("img");
      image.src = dataUrl;
      image.alt = "Car photo you selected";
      previews.appendChild(image);
    });
  }

  photoInput.addEventListener("change", function () {
    var files = Array.from(photoInput.files).slice(0, 4);
    chosenPhotos = new Array(files.length);
    photosLoading = files.length;

    files.forEach(function (file, index) {
      shrinkPhoto(file, function (dataUrl) {
        chosenPhotos[index] = dataUrl;
        photosLoading = photosLoading - 1;
        showPreviews();
      });
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    // Shrinking a photo takes a moment. Posting now would lose the ones that
    // are not ready yet, so ask for a second instead.
    if (photosLoading > 0) {
      message.textContent = "The photos are still loading. Please try again in a moment.";
      message.classList.remove("is-hidden");
      return;
    }

    var brand = el("sellBrand").value;
    var model = el("sellModel").value.trim();
    var mileage = el("sellMileage").value;
    var cars = getCars();

    var details = {
      ownerId: me.id,
      brand: brand,
      model: model,
      name: brand + " " + model,
      year: el("sellYear").value,
      price: Number(el("sellPrice").value || 0),
      mileage: mileage ? Number(mileage).toLocaleString("en-US") + " km" : "Not stated",
      transmission: el("sellTransmission").value,
      fuel: el("sellFuel").value,
      engine: editing ? editing.engine : "Not stated",
      location: el("sellLocation").value.trim(),
      description: el("sellDescription").value.trim() || "The owner has not added a description yet.",
      features: editing ? editing.features : [],
      photos: chosenPhotos.filter(Boolean),
      photo: editing ? editing.photo : "",
      status: editing ? editing.status : "Active"
    };

    var savedId;

    if (editing) {
      savedId = editing.id;
      cars = cars.map(function (car) {
        if (car.id !== editing.id) {
          return car;
        }
        return Object.assign({}, car, details);
      });
      message.textContent = "Changes saved. Opening your listing.";
    } else {
      savedId = nextId("car", cars, "id");
      details.id = savedId;
      details.created = Date.now();
      cars = [details].concat(cars);
      message.textContent = "Your car is posted. Opening your listing.";
    }

    saveCars(cars);
    message.classList.remove("is-hidden");
    window.location.href = "car-details.html?car=" + encodeURIComponent(savedId);
  });
}


/* ==========================================================================
   12. MY ACCOUNT PAGE
   Everything here belongs to the logged-in user only.
   ========================================================================== */

function initAccount() {
  var me = currentUser();
  if (!me) {
    return;
  }

  paintProfile(me);
  paintListings(me);
  paintSavedCars(me);
  paintMessages(me);

  // Switching between Profile, My Listings, Saved Cars and My Messages
  var tabs = el("accountTabs");

  tabs.addEventListener("click", function (event) {
    var tab = event.target.closest(".tab");
    if (!tab) {
      return;
    }

    tabs.querySelectorAll(".tab").forEach(function (other) {
      other.classList.toggle("is-active", other === tab);
    });

    document.querySelectorAll(".panel").forEach(function (panel) {
      panel.classList.toggle("is-active", panel.id === tab.dataset.panel);
    });
  });

  // Edit profile. The account id and email are never changed here.
  el("profileForm").addEventListener("submit", function (event) {
    event.preventDefault();

    var name = el("editName").value.trim();
    var place = el("editLocation").value.trim();
    var note = el("profileMessage");
    var file = el("editPhoto").files[0];

    function apply(picture) {
      var users = getUsers().map(function (user) {
        if (user.id !== me.id) {
          return user;
        }
        return Object.assign({}, user, {
          name: name || user.name,
          location: place || user.location,
          profile: picture === undefined ? user.profile : picture
        });
      });

      saveUsers(users);

      var updated = findUser(me.id);
      paintProfile(updated);
      paintNav();
      paintMessages(updated);

      note.textContent = "Profile updated.";
      note.classList.remove("is-hidden");
    }

    if (!file) {
      apply(undefined);
      return;
    }

    // A camera photo is far too big for browser storage, so shrink it first
    shrinkPhoto(file, function (picture) {
      apply(picture);
    });
  });

  el("logoutBtn").addEventListener("click", function () {
    logout();
    window.location.href = "index.html";
  });

  // Delete a listing
  el("myListings").addEventListener("click", function (event) {
    var button = event.target.closest("[data-delete]");
    if (!button) {
      return;
    }

    if (!window.confirm("Delete this listing?")) {
      return;
    }

    var carId = button.dataset.delete;
    saveCars(getCars().filter(function (car) { return car.id !== carId; }));
    paintListings(currentUser());
  });

  // Remove a car from Saved Cars
  el("savedCars").addEventListener("click", function (event) {
    var button = event.target.closest("[data-unsave]");
    if (!button) {
      return;
    }

    event.preventDefault();
    var user = currentUser();
    setSavedFor(user.id, getSavedFor(user.id).filter(function (id) {
      return id !== button.dataset.unsave;
    }));
    paintSavedCars(user);
  });
}

function paintProfile(user) {
  paintAvatar(el("profileAvatar"), user);
  el("profileName").textContent = user.name;
  el("profileEmail").textContent = user.email;
  el("profilePlace").textContent = user.location;

  el("accountName").textContent = user.name;
  el("accountEmail").textContent = user.email;
  el("accountLocation").textContent = user.location;
  el("accountCreated").textContent = longDate(user.created);

  el("editName").value = user.name;
  el("editLocation").value = user.location;
  document.title = user.name + " — AutoLynk";
}

function paintListings(user) {
  var box = el("myListings");
  var empty = el("listingsEmpty");
  var mine = carsOwnedBy(user.id);

  box.innerHTML = mine.map(function (car) {
    var cover = coverPhoto(car);
    var link = "car-details.html?car=" + encodeURIComponent(car.id);
    var badge = car.status === "Sold" ? "badge--sold" : "badge--active";

    return '<article class="listing">' +
        '<div class="photo-frame photo-frame--listing" data-file="' + safe(cover.label) + '">' +
          '<img class="photo-img" src="' + safe(cover.src) + '" alt="' + safe(car.name) + '">' +
        '</div>' +
        '<div>' +
          '<h3 class="listing-name">' + safe(car.name + " " + car.year) + '</h3>' +
          '<p class="listing-price">' + peso(car.price) + '</p>' +
          '<p class="listing-place">' + safe(car.location) + '</p>' +
          '<p class="badge ' + badge + '">' + safe(car.status) + '</p>' +
        '</div>' +
        '<div class="listing-actions">' +
          '<a class="btn btn--outline btn--small" href="' + link + '">View</a>' +
          '<a class="btn btn--outline btn--small" href="sell.html?edit=' +
            encodeURIComponent(car.id) + '">Edit</a>' +
          '<button class="btn btn--outline btn--small" type="button" data-delete="' +
            safe(car.id) + '">Delete</button>' +
        '</div>' +
      '</article>';
  }).join("");

  empty.classList.toggle("is-hidden", mine.length > 0);
  watchPhotos(box);
}

function paintSavedCars(user) {
  var grid = el("savedCars");
  var empty = el("savedEmpty");
  var saved = getSavedFor(user.id);

  // Drops any car that has since been deleted by its owner
  var cars = saved.map(findCar).filter(Boolean);

  if (cars.length !== saved.length) {
    setSavedFor(user.id, cars.map(function (car) { return car.id; }));
  }

  grid.innerHTML = cars.map(function (car) {
    return cardHtml(car, true);
  }).join("");

  empty.classList.toggle("is-hidden", cars.length > 0);
  watchPhotos(grid);
  paintSaveButtons();
}

function paintMessages(user) {
  var box = el("messageList");
  var empty = el("messagesEmpty");
  var chats = chatsFor(user.id);

  box.innerHTML = chats.map(function (chat) {
    var person = findUser(otherPersonId(chat, user.id));
    var car = findCar(chat.carId);
    var last = lastMessage(chat);
    var picture = person && person.profile
      ? '<img class="avatar-img" src="' + safe(person.profile) + '" alt="">'
      : safe(initials(person ? person.name : "?"));

    return '<a class="message-row" href="chat.html?conversation=' +
        encodeURIComponent(chat.conversationId) + '">' +
        '<span class="avatar" aria-hidden="true">' + picture + '</span>' +
        '<span class="message-preview">' +
          '<span class="convo-name">' + safe(person ? person.name : "Deleted account") + '</span>' +
          '<span class="convo-car">' + safe(car ? car.name + " " + car.year : "Listing removed") + '</span>' +
          '<span class="message-text">' + safe(last ? last.message : "No messages yet") + '</span>' +
        '</span>' +
        '<span class="message-time">' + (last ? safe(dayLabel(last.timestamp)) : "") + '</span>' +
      '</a>';
  }).join("");

  empty.classList.toggle("is-hidden", chats.length > 0);
}


/* ==========================================================================
   13. CHAT PAGE
   Only the logged-in user's conversations are shown.
   ========================================================================== */

var openChatId = "";

function initChat() {
  var me = currentUser();
  if (!me) {
    return;
  }

  // Arriving from "Chat with Owner" starts or reopens a conversation
  var askedCar = getQuery("car");
  var askedChat = getQuery("conversation");

  if (askedCar) {
    var started = startChatAbout(askedCar, me);
    if (started) {
      openChatId = started;
    }
  } else if (askedChat && findMyChat(askedChat, me.id)) {
    openChatId = askedChat;
  }

  var mine = chatsFor(me.id);

  if (!openChatId && mine.length) {
    openChatId = mine[0].conversationId;
  }

  paintChatList(me);
  paintThread(me);

  el("chatList").addEventListener("click", function (event) {
    var button = event.target.closest(".convo");
    if (!button) {
      return;
    }

    openChatId = button.dataset.chat;
    paintChatList(me);
    paintThread(me);
  });

  el("chatForm").addEventListener("submit", function (event) {
    event.preventDefault();

    var input = el("messageInput");
    var text = input.value.trim();
    var chat = findMyChat(openChatId, me.id);

    if (!text || !chat) {
      return;
    }

    var receiverId = otherPersonId(chat, me.id);

    chat.messages.push({
      messageId: nextId("msg", chat.messages, "messageId"),
      senderId: me.id,
      receiverId: receiverId,
      message: text,
      timestamp: Date.now()
    });

    // Saves the whole conversation back to storage
    saveChats(getChats().map(function (item) {
      return item.conversationId === chat.conversationId ? chat : item;
    }));

    input.value = "";
    paintChatList(me);
    paintThread(me);
  });
}

// Finds the conversation about a car, or creates a new one with the owner
function startChatAbout(carId, me) {
  var car = findCar(carId);
  if (!car) {
    return "";
  }

  var existing = chatsFor(me.id).filter(function (chat) {
    return chat.carId === carId;
  })[0];

  if (existing) {
    return existing.conversationId;
  }

  // You cannot message yourself about your own listing
  if (car.ownerId === me.id) {
    return "";
  }

  var chats = getChats();

  var fresh = {
    conversationId: nextId("conv", chats, "conversationId"),
    carId: carId,
    buyerId: me.id,
    sellerId: car.ownerId,
    messages: []
  };

  chats.push(fresh);
  saveChats(chats);
  return fresh.conversationId;
}

function paintChatList(me) {
  var list = el("chatList");
  var empty = el("chatListEmpty");
  var chats = chatsFor(me.id);

  list.innerHTML = chats.map(function (chat) {
    var person = findUser(otherPersonId(chat, me.id));
    var car = findCar(chat.carId);
    var last = lastMessage(chat);
    var picture = person && person.profile
      ? '<img class="avatar-img" src="' + safe(person.profile) + '" alt="">'
      : safe(initials(person ? person.name : "?"));

    return '<button class="convo' + (chat.conversationId === openChatId ? " is-active" : "") +
        '" type="button" data-chat="' + safe(chat.conversationId) + '">' +
        '<span class="avatar" aria-hidden="true">' + picture + '</span>' +
        '<span class="convo-text">' +
          '<span class="convo-name">' + safe(person ? person.name : "Deleted account") + '</span>' +
          '<span class="convo-car">' + safe(car ? car.name + " " + car.year : "Listing removed") + '</span>' +
          '<span class="convo-last">' + safe(last ? last.message : "No messages yet") + '</span>' +
        '</span>' +
        '<span class="convo-time">' + (last ? safe(dayLabel(last.timestamp)) : "") + '</span>' +
      '</button>';
  }).join("");

  empty.classList.toggle("is-hidden", chats.length > 0);
}

function paintThread(me) {
  var body = el("chatBody");
  var form = el("chatForm");
  var chat = findMyChat(openChatId, me.id);

  if (!chat) {
    el("chatAvatar").textContent = "?";
    el("chatName").textContent = "Pick a conversation";
    el("chatCar").textContent = "";
    body.innerHTML = '<p class="chat-note">Select a conversation on the left to see the messages, ' +
      'or open a car and press <strong>Chat with Owner</strong>.</p>';
    form.classList.add("is-hidden");
    return;
  }

  var person = findUser(otherPersonId(chat, me.id));
  var car = findCar(chat.carId);

  form.classList.remove("is-hidden");
  paintAvatar(el("chatAvatar"), person);
  el("chatName").textContent = person ? person.name : "Deleted account";
  el("chatCar").textContent = car ? car.name + " " + car.year : "Listing removed";

  if (!chat.messages.length) {
    body.innerHTML = '<p class="chat-note">No messages yet. Say hello to ' +
      safe(person ? person.name : "the owner") + '.</p>';
    return;
  }

  body.innerHTML = chat.messages.map(function (message) {
    var mine = message.senderId === me.id;

    return '<div class="bubble ' + (mine ? "bubble--me" : "bubble--them") + '">' +
        safe(message.message) +
        '<span class="bubble-time">' + safe(clockTime(message.timestamp)) + '</span>' +
      '</div>';
  }).join("");

  // Always show the newest message
  body.scrollTop = body.scrollHeight;
}


/* ==========================================================================
   14. LOGIN AND REGISTER PAGES
   ========================================================================== */

// Only allows links inside this project, never an address on another site
function safeNext(value) {
  if (!value || value.indexOf(":") > -1 || value.indexOf("//") > -1) {
    return "account.html";
  }
  return value;
}

function initLogin() {
  var form = el("loginForm");
  var note = el("loginMessage");
  var next = getQuery("next");

  if (next) {
    note.textContent = "Please log in to continue.";
    note.classList.remove("is-hidden");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var email = el("loginEmail").value.trim();
    var password = el("loginPassword").value;
    var user = findUserByEmail(email);

    note.classList.remove("is-hidden");

    if (!user || user.password !== password) {
      note.textContent = "That email and password do not match an account.";
      return;
    }

    loginAs(user);
    note.textContent = "Welcome back, " + user.name + ".";
    window.location.href = safeNext(next);
  });
}

function initRegister() {
  var form = el("registerForm");
  var note = el("registerMessage");

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var name = el("registerName").value.trim();
    var email = el("registerEmail").value.trim();
    var password = el("registerPassword").value;
    var confirm = el("registerConfirm").value;
    var place = el("registerLocation").value.trim();

    note.classList.remove("is-hidden");

    if (password !== confirm) {
      note.textContent = "The two passwords do not match.";
      return;
    }

    if (findUserByEmail(email)) {
      note.textContent = "That email already has an account. Try logging in.";
      return;
    }

    var users = getUsers();

    var user = {
      id: nextId("user", users, "id"),
      name: name,
      email: email,
      password: password,
      location: place,
      profile: "",
      created: Date.now(),
      savedCars: []
    };

    users.push(user);
    saveUsers(users);
    loginAs(user);

    note.textContent = "Account created. Opening your account.";
    window.location.href = "account.html";
  });
}


/* ==========================================================================
   15. START THE PAGE
   ========================================================================== */

function setupMobileMenu() {
  var toggle = el("navToggle");
  var menu = el("mobileMenu");

  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener("click", function () {
    var isOpen = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  });
}

seedDemoData();
setupMobileMenu();
paintNav();
watchPhotos();

if (guardPage()) {
  var page = document.body.id;

  if (page === "page-index") { initHome(); }
  if (page === "page-browse") { initBrowse(); }
  if (page === "page-details") { initDetails(); }
  if (page === "page-sell") { initSell(); }
  if (page === "page-account") { initAccount(); }
  if (page === "page-chat") { initChat(); }
  if (page === "page-login") { initLogin(); }
  if (page === "page-register") { initRegister(); }

  paintSaveButtons();
}
