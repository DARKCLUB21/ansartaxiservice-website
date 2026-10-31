"use strict";

const BUSINESS_WHATSAPP = "918660629533";

const bookingForm = document.getElementById("bookingForm");
const formStatus = document.getElementById("formStatus");
const travelDate = document.getElementById("travelDate");
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

// Prevent selecting a date in the past.
function setMinimumTravelDate() {
  if (!travelDate) return;

  const now = new Date();
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");

  travelDate.min = localDate;
}

setMinimumTravelDate();

// Mobile navigation.
if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu"
    );
    menuToggle.textContent = isOpen ? "✕" : "☰";
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation menu");
      menuToggle.textContent = "☰";
    });
  });
}

// Service and vehicle shortcuts.
document.querySelectorAll("[data-service]").forEach((link) => {
  link.addEventListener("click", () => {
    const serviceSelect = document.getElementById("service");
    if (serviceSelect) {
      serviceSelect.value = link.dataset.service;
    }
  });
});

document.querySelectorAll("[data-vehicle]").forEach((link) => {
  link.addEventListener("click", () => {
    const vehicleSelect = document.getElementById("vehicle");
    if (vehicleSelect) {
      vehicleSelect.value = link.dataset.vehicle;
    }
  });
});

// Google Places autocomplete and route distance.
const pickupInput = document.getElementById("pickup");
const destinationInput = document.getElementById("destination");
const routeEstimate = document.getElementById("routeEstimate");

const locationFields = {
  pickup: {
    place: document.getElementById("pickupPlaceId"),
    lat: document.getElementById("pickupLat"),
    lng: document.getElementById("pickupLng")
  },
  destination: {
    place: document.getElementById("destinationPlaceId"),
    lat: document.getElementById("destinationLat"),
    lng: document.getElementById("destinationLng")
  }
};

let selectedPickup = null;
let selectedDestination = null;

function clearSelectedLocation(type) {
  const fields = locationFields[type];
  if (fields) {
    fields.place.value = "";
    fields.lat.value = "";
    fields.lng.value = "";
  }
  if (type === "pickup") selectedPickup = null;
  if (type === "destination") selectedDestination = null;
  if (routeEstimate) {
    routeEstimate.textContent =
      "Select pickup and destination from the suggestions to calculate route distance.";
  }
}

async function updateRouteEstimate() {
  if (!selectedPickup || !selectedDestination || !routeEstimate) return;

  const apiBase = String(
    (window.ANSAR_CONFIG || {}).API_BASE_URL || ""
  ).trim().replace(/\/+$/, "");

  if (!apiBase) {
    routeEstimate.textContent =
      "Both locations selected. Route distance will be available after backend deployment.";
    return;
  }

  routeEstimate.textContent = "Calculating road distance...";

  try {
    const response = await fetch(`${apiBase}/api/routes/distance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup_lat: selectedPickup.lat,
        pickup_lng: selectedPickup.lng,
        destination_lat: selectedDestination.lat,
        destination_lng: selectedDestination.lng
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.detail || "Route calculation unavailable.");
    }

    routeEstimate.textContent =
      `Approx. road distance: ${result.distance_km} km · Estimated travel time: ${result.duration}. Fare to be confirmed by ANSAR TAXI SERVICE.`;
  } catch (error) {
    routeEstimate.textContent =
      "Route distance is temporarily unavailable. You can still submit your booking enquiry.";
  }
}

function initializeAnsarPlaces() {
  if (!window.google?.maps?.places?.Autocomplete) {
    if (routeEstimate) {
      routeEstimate.textContent = "Google Places could not be loaded. You can enter locations manually.";
    }
    return;
  }

  const setupAutocomplete = (input, type) => {
    if (!input) return;

    const autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ["place_id", "formatted_address", "geometry"],
      componentRestrictions: { country: "in" }
    });

    input.addEventListener("input", () => clearSelectedLocation(type));

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;

      if (!location || !place.place_id) {
        clearSelectedLocation(type);
        if (routeEstimate) {
          routeEstimate.textContent = "Please select a valid location from the suggestions.";
        }
        return;
      }

      const selected = {
        placeId: place.place_id,
        lat: location.lat(),
        lng: location.lng()
      };

      input.value = place.formatted_address || input.value;
      locationFields[type].place.value = selected.placeId;
      locationFields[type].lat.value = String(selected.lat);
      locationFields[type].lng.value = String(selected.lng);

      if (type === "pickup") selectedPickup = selected;
      else selectedDestination = selected;

      updateRouteEstimate();
    });
  };

  setupAutocomplete(pickupInput, "pickup");
  setupAutocomplete(destinationInput, "destination");
}

(function loadAnsarGoogleMaps() {
  const key = String(
    (window.ANSAR_CONFIG || {}).GOOGLE_MAPS_BROWSER_KEY || ""
  ).trim();

  if (!key) {
    if (routeEstimate) {
      routeEstimate.textContent = "Enter locations manually. Google Maps autocomplete is not configured yet.";
    }
    return;
  }

  window.initAnsarMaps = initializeAnsarPlaces;
  const mapsScript = document.createElement("script");
  mapsScript.src =
    `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=initAnsarMaps&loading=async`;
  mapsScript.async = true;
  mapsScript.defer = true;
  mapsScript.onerror = () => {
    if (routeEstimate) {
      routeEstimate.textContent = "Google Maps failed to load. You can still enter locations manually.";
    }
  };
  document.head.appendChild(mapsScript);
})();

// Save booking first when the backend is configured, then open WhatsApp.
if (bookingForm) {
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!bookingForm.reportValidity()) return;

    const submitButton = bookingForm.querySelector('[type="submit"]');
    const data = new FormData(bookingForm);
    const value = (key) => String(data.get(key) || "").trim();

    const customerName = value("customerName");
    const customerPhone = value("customerPhone");
    const pickup = value("pickup");
    const destination = value("destination");
    const selectedDate = value("travelDate");
    const selectedTime = value("travelTime");

    if (!customerName || !customerPhone || !pickup || !destination ||
        !selectedDate || !selectedTime) {
      formStatus.textContent = "Please complete all required fields.";
      return;
    }

    const requestedDateTime = new Date(`${selectedDate}T${selectedTime}`);
    if (Number.isNaN(requestedDateTime.getTime()) ||
        requestedDateTime.getTime() < Date.now()) {
      formStatus.textContent =
        "Please select a future date and time for your journey.";
      return;
    }

    const config = window.ANSAR_CONFIG || {};
    const apiBase = String(config.API_BASE_URL || "").trim().replace(/\/+$/, "");
    let bookingId = null;

    const makeWhatsAppURL = () => {
      const message = [
        "Hello ANSARTAXISERVICE!",
        "",
        "I would like to enquire about a taxi booking.",
        ...(bookingId ? [`Booking ID: ${bookingId}`, ""] : []),
        `Name: ${customerName}`,
        `Customer mobile: ${customerPhone}`,
        `Service: ${value("service")}`,
        `Pickup: ${pickup}`,
        `Destination: ${destination}`,
        `Travel date: ${selectedDate}`,
        `Pickup time: ${selectedTime}`,
        `Trip type: ${value("tripType")}`,
        `Vehicle preference: ${value("vehicle")}`,
        `Passengers: ${value("passengers")}`,
        "",
        "Please confirm vehicle availability and the total fare.",
        "This is a booking enquiry, not a confirmed reservation."
      ].join("\n");

      return `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(message)}`;
    };

    if (submitButton) submitButton.disabled = true;
    formStatus.textContent = apiBase
      ? "Saving your booking enquiry..."
      : "Opening WhatsApp...";

    try {
      if (apiBase) {
        const payload = {
          customer_name: customerName,
          customer_phone: customerPhone,
          service: value("service"),
          pickup,
          destination,
          travel_date: selectedDate,
          travel_time: selectedTime,
          trip_type: value("tripType"),
          vehicle: value("vehicle"),
          passengers: Number(value("passengers")),
          pickup_place_id: value("pickupPlaceId") || null,
          destination_place_id: value("destinationPlaceId") || null,
          pickup_lat: value("pickupLat") ? Number(value("pickupLat")) : null,
          pickup_lng: value("pickupLng") ? Number(value("pickupLng")) : null,
          destination_lat: value("destinationLat") ? Number(value("destinationLat")) : null,
          destination_lng: value("destinationLng") ? Number(value("destinationLng")) : null
        };

        const response = await fetch(`${apiBase}/api/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof result.detail === "string"
              ? result.detail
              : "Booking could not be saved. Please try again."
          );
        }

        bookingId = result.booking_id;
        if (!bookingId) {
          throw new Error("Server did not return a Booking ID.");
        }
      }

      const whatsappURL = makeWhatsAppURL();
      const whatsappWindow = window.open(
        whatsappURL, "_blank", "noopener,noreferrer"
      );

      if (!whatsappWindow) {
        window.location.href = whatsappURL;
      }

      formStatus.textContent = bookingId
        ? `Booking enquiry saved! Your Booking ID is ${bookingId}. Please send the WhatsApp message to contact us.`
        : "Opening WhatsApp with your booking enquiry. Please send the message to contact us.";
    } catch (error) {
      formStatus.textContent =
        error.message || "Something went wrong. Please try again.";
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// Footer year.
const currentYear = document.getElementById("currentYear");
if (currentYear) {
  currentYear.textContent = String(new Date().getFullYear());
}
