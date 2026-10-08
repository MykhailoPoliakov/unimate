function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function withMail(text, email) {
  const safe = escapeHtml(text);
  if (!email) return safe;
  return safe.replaceAll(email, `<a class="mail" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`);
}

function renderSection(section, email) {
  const items = section.items?.length
    ? `<ul>${section.items.map((item) => `<li>${withMail(item, email)}</li>`).join('')}</ul>`
    : '';
  const paragraphs = (section.paragraphs ?? []).map((p) => `<p>${withMail(p, email)}</p>`).join('');
  return `<section class="card"><h2>${escapeHtml(section.title)}</h2>${items}${paragraphs}</section>`;
}

const root = document.getElementById('page');
const src = root?.dataset.doc;
if (!src) throw new Error('Missing data-doc');

fetch(src)
  .then((response) => response.json())
  .then((doc) => {
    document.title = `${doc.title} — UniMate`;
    const email = doc.email ?? 'unimate.app@proton.me';
    const intro = (doc.intro ?? []).map((p) => `<p>${withMail(p, email)}</p>`).join('');
    const sections = (doc.sections ?? []).map((section) => renderSection(section, email)).join('');
    const updated = doc.updated ? `<p class="updated">${escapeHtml(doc.updated)}</p>` : '';
    root.innerHTML = `
      <a class="brand" href="index.html">UniMate</a>
      <h1>${escapeHtml(doc.title)}</h1>
      ${updated}
      ${intro}
      ${sections}
      <p class="links">
        <a href="privacy-policy.html">Privacy</a>
        <a href="terms-of-use.html">Terms</a>
        <a href="support.html">Support</a>
        <a href="about.html">About</a>
      </p>
    `;
  });
