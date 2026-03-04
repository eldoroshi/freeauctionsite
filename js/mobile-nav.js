(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var hamburger = document.getElementById('hamburger');
        var navLinks = document.getElementById('navLinks');
        if (!hamburger || !navLinks) return;

        // Position dropdown just below the navbar
        function setDropdownTop() {
            var navbar = document.querySelector('.navbar');
            if (navbar) navLinks.style.top = navbar.offsetHeight + 'px';
        }

        setDropdownTop();
        window.addEventListener('resize', setDropdownTop);

        // Toggle open/close
        hamburger.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = navLinks.classList.toggle('open');
            hamburger.classList.toggle('open', isOpen);
            hamburger.setAttribute('aria-expanded', String(isOpen));
        });

        // Close when a nav link is clicked
        navLinks.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                navLinks.classList.remove('open');
                hamburger.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });

        // Close when clicking outside
        document.addEventListener('click', function (e) {
            if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('open');
                hamburger.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        });
    });
}());
