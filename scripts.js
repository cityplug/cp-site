const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const messageInput = document.getElementById("message");
const charUsed = document.getElementById("char-used");
const contactForm = document.getElementById("contact-form");
const formStatus = document.querySelector("[data-form-status]");
const currentYear = document.querySelector("[data-current-year]");

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
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    header.classList.toggle("nav-active", isOpen);
    document.body.classList.toggle("nav-open", isOpen);
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      header.classList.remove("nav-active");
      document.body.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
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
      submitButton.textContent = "Sending...";
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
      setFormStatus("Submitting securely. If this does not continue, email info@cityplug.co.uk.", "");
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
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
