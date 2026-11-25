document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".ka-status").forEach((badge) => {
    badge.setAttribute("role", "status");
  });
});
