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
