// Sticky navbar on scroll
window.addEventListener("scroll", function () {
  const navbar = document.querySelector(".navbar");
  navbar.classList.toggle("sticky", window.scrollY > 10);
});

// Live character counter
const messageInput = document.getElementById("message");
const charUsed = document.getElementById("char-used");

if (messageInput && charUsed) {
  messageInput.addEventListener("input", () => {
    charUsed.textContent = messageInput.value.length;
  });
}

// Honeypot spam trap
document.getElementById("contact-form").addEventListener("submit", function (e) {
  const gotcha = this.querySelector('input[name="_gotcha"]');
  if (gotcha && gotcha.value !== "") {
    e.preventDefault(); // Bot caught
    return;
  }
});

// Animate on scroll
const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.1,
  }
);

// Observe fade-in and zoom-in elements
document.querySelectorAll('.fade-in, .zoom-in').forEach(el => {
  observer.observe(el);
});
