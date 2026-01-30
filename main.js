/**
 * almitu - Main JavaScript
 * Interactive functionality and user experience enhancements
 * © 2026 almitu
 */

// FAQ accordion
function toggleFaq(button) {
  const item = button.closest('.faq-item');
  const wasActive = item.classList.contains('active');

  // Close all
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));

  // Open clicked if it wasn't active
  if (!wasActive) {
    item.classList.add('active');
  }
}

// Active nav highlighting
const navLinks = Array.from(document.querySelectorAll('.nav-links a'))
  .filter(a => a.getAttribute('href')?.startsWith('#'));

const sections = navLinks
  .map(a => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(a => a.classList.remove('active'));
      const active = navLinks.find(a => a.getAttribute('href') === '#' + entry.target.id);
      if (active) active.classList.add('active');
    }
  });
}, { root: null, threshold: 0.3 });

sections.forEach(sec => observer.observe(sec));

// Smooth scroll with offset
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;

    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const headerHeight = document.querySelector('.site-header').offsetHeight;
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  });
});

// External link handling with error fallback
document.querySelectorAll('a[href^="https://forms.gle"]').forEach(link => {
  link.addEventListener('click', function (e) {
    // Track clicks if analytics is set up
    if (typeof gtag !== 'undefined') {
      gtag('event', 'click', {
        'event_category': 'CTA',
        'event_label': this.textContent.trim(),
        'value': 1
      });
    }
  });
});

// Add loading state to external links
document.querySelectorAll('a[target="_blank"]').forEach(link => {
  link.setAttribute('rel', link.getAttribute('rel') ? link.getAttribute('rel') + ' noopener noreferrer' : 'noopener noreferrer');
});

// Simple performance monitoring
window.addEventListener('load', () => {
  const perfData = performance.timing;
  const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
  
  // Send to analytics if available
  if (typeof gtag !== 'undefined') {
    gtag('event', 'timing_complete', {
      name: 'page_load',
      value: pageLoadTime,
      event_category: 'Performance'
    });
  }
});

// Form validation helper (if you add contact forms later)
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}
