/** Hash-based router */
const routes = {};
let currentRoute = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return currentRoute;
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || "/dashboard";
  const path = hash.split("?")[0];
  const params = Object.fromEntries(new URLSearchParams(hash.split("?")[1] || ""));

  currentRoute = { path, params };

  const handler = routes[path];
  if (handler) {
    handler(params);
  } else {
    // Default to dashboard
    navigate("/dashboard");
  }

  // Update active nav link
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href")?.slice(1);
    a.classList.toggle("active", href === path);
  });
}

export function initRouter() {
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}
