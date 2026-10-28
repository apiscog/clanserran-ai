function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="shell site-footer-content">
        <a
          className="instagram-link"
          href="https://www.instagram.com/andrespisco/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visitar el Instagram de Andrés Pisco (se abre en una pestaña nueva)"
        >
          <InstagramIcon />
          <span>Instagram · @andrespisco</span>
        </a>
        <p className="small muted">© {year} Andrés Pisco</p>
      </div>
    </footer>
  );
}
