const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const messageInput = document.getElementById("message");
const charUsed = document.getElementById("char-used");
const contactForm = document.getElementById("contact-form");
const formStatus = document.querySelector("[data-form-status]");
const currentYear = document.querySelector("[data-current-year]");
const serviceSelect = document.getElementById("service");

if (serviceSelect) {
  const searchParams = new URLSearchParams(window.location.search);
  const requestedService = searchParams.get("service");
  const serviceOptions = {
    cctv: "CCTV installation",
    wifi: "Home Wi-Fi improvement",
    business: "Business Wi-Fi",
    cabling: "Structured cabling",
  };

  if (requestedService && serviceOptions[requestedService]) {
    serviceSelect.value = serviceOptions[requestedService];
  }
}

// Staff shortcut: on a staff device the footer "quote form" link opens the private quote tool.
// Switch on once per device with https://www.cityplug.co.uk/#team=https://<name>.<tailnet>.ts.net
// and off with #team=off. The address lives only in that browser's storage; visitors always get #contact.
(() => {
  const KEY = "cityplug-team-url";
  const toTeamUrl = (value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".ts.net") || url.username || url.password) return "";
      return url.origin + "/";
    } catch (error) {
      return "";
    }
  };
  let store = null;
  try {
    store = window.localStorage;
  } catch (error) {
    store = null;
  }
  const readHash = () => {
    const hash = window.location.hash;
    if (!store || !hash.startsWith("#team=")) return;
    try {
      const value = decodeURIComponent(hash.slice(6));
      if (value === "off") {
        store.removeItem(KEY);
      } else if (toTeamUrl(value)) {
        store.setItem(KEY, toTeamUrl(value));
      }
    } catch (error) {
      /* storage blocked: leave the public link alone */
    }
    history.replaceState(null, "", window.location.pathname + window.location.search);
  };
  const applyLink = () => {
    let saved = "";
    try {
      saved = store ? toTeamUrl(store.getItem(KEY) || "") : "";
    } catch (error) {
      saved = "";
    }
    document.querySelectorAll("[data-team-link]").forEach((link) => {
      link.href = saved || "#contact";
      if (saved) {
        link.title = "Opens the private CityPlug quote tool (staff device)";
      } else {
        link.removeAttribute("title");
      }
    });
  };
  readHash();
  applyLink();
  window.addEventListener("hashchange", () => {
    readHash();
    applyLink();
  });
})();

function updateHeaderState() {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 12);
}

window.addEventListener("scroll", updateHeaderState, { passive: true });
updateHeaderState();

if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

if (navToggle && nav && header) {
  const closeNavigation = ({ restoreFocus = false } = {}) => {
    nav.classList.remove("is-open");
    header.classList.remove("nav-active");
    document.body.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open navigation");
    if (restoreFocus) navToggle.focus();
  };

  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    header.classList.toggle("nav-active", isOpen);
    document.body.classList.toggle("nav-open", isOpen);
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeNavigation());
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      closeNavigation({ restoreFocus: true });
    }
  });
}

if (messageInput && charUsed) {
  const updateCount = () => {
    charUsed.textContent = messageInput.value.length;
  };

  messageInput.addEventListener("input", updateCount);
  updateCount();
}

if (contactForm) {
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton ? submitButton.textContent : "";
  let isNativeSubmit = false;

  const setFormStatus = (message, type) => {
    if (!formStatus) return;
    formStatus.textContent = message;
    formStatus.classList.remove("is-success", "is-error");

    if (type) {
      formStatus.classList.add(`is-${type}`);
    }
  };

  contactForm.addEventListener("submit", async (event) => {
    if (isNativeSubmit) {
      return;
    }

    const trap = contactForm.querySelector('input[name="_gotcha"]');

    if (trap && trap.value.trim() !== "") {
      event.preventDefault();
      contactForm.reset();
      if (charUsed) charUsed.textContent = "0";
      setFormStatus("", "");
      return;
    }

    event.preventDefault();
    setFormStatus("", "");

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending…";
    }

    try {
      const response = await fetch(contactForm.action, {
        method: "POST",
        body: new FormData(contactForm),
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Formspree rejected the submission");
      }

      contactForm.reset();
      if (charUsed) charUsed.textContent = "0";
      setFormStatus("Thanks. Your enquiry has been sent and we will reply as soon as possible.", "success");
    } catch (error) {
      setFormStatus("Still sending… If nothing happens, email info@cityplug.co.uk.", "");
      isNativeSubmit = true;
      contactForm.submit();
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
      }
    }
  });
}

const revealItems = document.querySelectorAll(".section-reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (entry.target.hasAttribute("data-lazy-background")) {
            entry.target.classList.add("background-ready");
          }
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => {
    if (item.hasAttribute("data-lazy-background")) {
      item.classList.add("background-ready");
    }
    item.classList.add("is-visible");
  });
}

// Pointer-follow light on cards and panels. Mouse/trackpad only; off when the user prefers reduced motion.
(() => {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!finePointer.matches || reduceMotion.matches) return;

  const surfaces = document.querySelectorAll(
    ".service-card, .audience-card, .process-grid article, .feature-panel, .quote-form, .service-panel, .service-visual, .cta-strip"
  );

  surfaces.forEach((surface) => {
    surface.classList.add("glow-surface");
    let frame = 0;
    let x = 0;
    let y = 0;

    surface.addEventListener("pointermove", (event) => {
      const rect = surface.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        surface.style.setProperty("--mx", `${x}px`);
        surface.style.setProperty("--my", `${y}px`);
        frame = 0;
      });
    });
  });
})();
