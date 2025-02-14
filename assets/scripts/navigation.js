const scrollThreshold = 0;
function onload() {
    const navigation = document.querySelector('header .r-side-nav');
    window.ccPorted = window.ccPorted || {};
    if (navigation) {
        const currentLocation = window.location.pathname;
        log("Current location", currentLocation);
        navigation.querySelectorAll('a').forEach((link) => {
            if (link.getAttribute('href') == currentLocation) {
                link.classList.add('link-active');
                link.classList.add('cc');
            }
        });
        if (currentLocation !== "/") {
            log("Adding back button");
            document.querySelector("header").querySelector("h1").innerHTML = "";
            const back = document.createElement("a");
            back.href = "/";
            back.innerHTML = "<- Home";
            back.classList.add("cc");
            document.querySelector("header").querySelector("h1").appendChild(back);

        }
    }
}



// Header animation
document.addEventListener('DOMContentLoaded', () => {
    onload();
    const header = document.querySelector('header');
    // Hamburger menu functionality
    const hamburger = document.createElement('div');
    hamburger.className = 'hamburger';
    hamburger.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    header.appendChild(hamburger);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);

    const sideNav = document.querySelector('.r-side-nav') || document.querySelector('.l-side-nav');
    const fromSide = document.querySelector('.r-side-nav') ? 'right' : 'left';
    // Move side nav from header to body

    if (window.innerWidth < 768) {
        document.body.appendChild(sideNav);
    }
    // Handle menu toggle
    const toggleMenu = () => {
        hamburger.classList.toggle('active');
        sideNav.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = sideNav.classList.contains('active') ? 'hidden' : '';
    };

    hamburger.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);

    // Close menu on link click
    sideNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            toggleMenu();
        });
    });
    let lastScrollY = window.scrollY;
    let ticking = false;

    // Initialize header state
    header.classList.add('expanded');

    const updateHeader = () => {
        const scrollY = window.scrollY;
        
        // Determine scroll direction
        const isScrollingDown = scrollY > lastScrollY;
        
        // Update header classes based on scroll position and direction
        if (scrollY > 50) {
            if (isScrollingDown) {
                header.classList.remove('expanded');
                header.classList.add('collapsed');
                header.classList.add('shadow');
            } else {
                header.classList.add('expanded');
                header.classList.remove('collapsed');
            }
        } else {
            header.classList.add('expanded');
            header.classList.remove('collapsed');
            header.classList.remove('shadow');
        }

        lastScrollY = scrollY;
        ticking = false;
    };

    // Add scroll event listener with requestAnimationFrame for performance
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateHeader();
                ticking = false;
            });
            ticking = true;
        }
    });

    // Handle resize events
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Reset header state on resize
            header.classList.add('expanded');
            header.classList.remove('collapsed');
            if (window.innerWidth < 768) {
                document.body.appendChild(sideNav);
            }else{
                header.appendChild(sideNav);
            }
            lastScrollY = window.scrollY;
            updateHeader();
        }, 250);
    });
});
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > scrollThreshold) {
        header.classList.add('shadow');
    } else {
        header.classList.remove('shadow');
    }
    // check if ad is visible
    const ads = document.querySelectorAll(".tad");
    ads.forEach(ad => {
        if (ad.getAttribute("data-loaded-check") == "true") return;
        if (ad.getBoundingClientRect().top < window.innerHeight) {
            // allow a 5s loading grace period
            setTimeout(() => {
                // check if ad loaded (will have Iframe)
                if (ad.querySelector("iframe")) {
                    ad.setAttribute("data-loaded-check", "true");
                    ad.style.backgroundImage = "none";
                } else {
                    ad.remove();
                }
            }, 5000)
        }
    });
});