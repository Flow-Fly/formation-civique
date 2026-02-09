/** Header/navigation component */

export function renderHeader() {
  const header = document.getElementById("app-header");
  header.innerHTML = `
    <a href="#/dashboard" class="logo">Formation Civique</a>
    <nav>
      <ul class="nav-links">
        <li><a href="#/dashboard"><span class="icon">&#9633;</span><span class="label">Tableau</span></a></li>
        <li><a href="#/study"><span class="icon">&#9656;</span><span class="label">Fiches</span></a></li>
        <li><a href="#/quiz"><span class="icon">&#10003;</span><span class="label">Quiz</span></a></li>
        <li><a href="#/flashcards"><span class="icon">&#9830;</span><span class="label">Cartes</span></a></li>
        <li><a href="#/settings"><span class="icon">&#9881;</span><span class="label">Config</span></a></li>
      </ul>
    </nav>
  `;
}
