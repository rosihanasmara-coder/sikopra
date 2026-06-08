// Modal helpers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// Close modal on overlay click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Close modal on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

// Sidebar toggle for mobile
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// Auto-dismiss alerts after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(function(alert) {
    setTimeout(function() {
      alert.style.transition = 'opacity 0.5s';
      alert.style.opacity = '0';
      setTimeout(function() { alert.style.display = 'none'; }, 500);
    }, 5000);
  });
});

// Format number inputs with thousand separator display (for UX)
document.addEventListener('DOMContentLoaded', function() {
  // Highlight active nav on load
  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar-nav a').forEach(function(link) {
    const href = link.getAttribute('href');
    if (href && currentPath === href) {
      link.classList.add('active');
    }
  });
});
