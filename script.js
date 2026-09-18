    (function () {
      "use strict";

      // ------------------------------------------------------------------------
      // 1. DOM Elements
      // ------------------------------------------------------------------------
      const htmlEl = document.documentElement;
      const themeToggleBtn = document.getElementById("themeToggleBtn");
      const mobileNavBtn = document.getElementById("mobileNavBtn");
      const navMenu = document.getElementById("navMenu");
      const navLinks = document.querySelectorAll(".nav-link");
      const backToTopBtn = document.getElementById("backToTopBtn");
      const currentYearEl = document.getElementById("currentYear");
      const contactForm = document.getElementById("contactForm");
      const formSuccessAlert = document.getElementById("formSuccessAlert");
      const projectModal = document.getElementById("projectModal");
      const modalTitle = document.getElementById("modalTitle");
      const modalDesc = document.getElementById("modalDesc");
      const modalCloseBtn = document.getElementById("modalCloseBtn");
      const modalDismissBtn = document.getElementById("modalDismissBtn");
      const modalContactBtn = document.getElementById("modalContactBtn");
      const viewProjBtns = document.querySelectorAll(".view-proj-btn");
      const revealElements = document.querySelectorAll(".reveal");
      const scrollProgressBar = document.getElementById("scrollProgressBar");
      const interactiveCards = document.querySelectorAll(".interactive-card, .skill-item");

      // Set dynamic year
      if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
      }

      // Pointer detection & coordinates for card hover / particles
      const hasFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
      let mouseX = window.innerWidth / 2;
      let mouseY = window.innerHeight / 2;
      if (hasFinePointer) {
        window.addEventListener("mousemove", (e) => {
          mouseX = e.clientX;
          mouseY = e.clientY;
        }, { passive: true });
      }

      // ------------------------------------------------------------------------
      // 2. Dark / Light Mode Toggle with LocalStorage
      // ------------------------------------------------------------------------
      function initTheme() {
        const savedTheme = localStorage.getItem("heba_portfolio_theme");
        if (savedTheme) {
          htmlEl.setAttribute("data-theme", savedTheme);
        } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
          htmlEl.setAttribute("data-theme", "light");
        } else {
          htmlEl.setAttribute("data-theme", "dark");
        }
      }

      function toggleTheme() {
        const currentTheme = htmlEl.getAttribute("data-theme") || "dark";
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        htmlEl.setAttribute("data-theme", newTheme);
        localStorage.setItem("heba_portfolio_theme", newTheme);
      }

      if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", toggleTheme);
      }
      initTheme();



      // ------------------------------------------------------------------------
      // 4. Mouse Move Spotlight & 3D Tilt on Cards (Desktop Pointer Only)
      // ------------------------------------------------------------------------
      if (hasFinePointer) {
        interactiveCards.forEach((card) => {
          card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            card.style.setProperty("--mouse-x", `${x}px`);
            card.style.setProperty("--mouse-y", `${y}px`);

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -4;
            const rotateY = ((x - centerX) / centerX) * 4;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
          }, { passive: true });

          card.addEventListener("mouseleave", () => {
            card.style.transform = "";
          });
        });
      }

      // ------------------------------------------------------------------------
      // 5. Lightweight Interactive Particle Canvas Background
      // ------------------------------------------------------------------------
      const canvas = document.getElementById("bgCanvas");
      if (canvas) {
        const ctx = canvas.getContext("2d");
        let particles = [];
        let canvasWidth = (canvas.width = window.innerWidth);
        let canvasHeight = (canvas.height = window.innerHeight);
        const isMobileDevice = window.innerWidth < 768 || !hasFinePointer;

        function resizeCanvas() {
          canvasWidth = canvas.width = window.innerWidth;
          canvasHeight = canvas.height = window.innerHeight;
          initParticles();
        }
        window.addEventListener("resize", resizeCanvas, { passive: true });

        const particleCount = isMobileDevice ? 12 : Math.min(Math.floor(window.innerWidth / 28), 40);

        function getParticleColors() {
          const isLight = htmlEl.getAttribute("data-theme") === "light";
          if (isLight) {
            return ["rgba(133, 57, 83, 0.4)", "rgba(140, 86, 212, 0.4)", "rgba(97, 45, 83, 0.35)"];
          }
          return ["rgba(220, 149, 255, 0.55)", "rgba(255, 190, 251, 0.5)", "rgba(140, 86, 212, 0.5)", "rgba(255, 244, 191, 0.4)"];
        }

        class Particle {
          constructor() {
            this.x = Math.random() * canvasWidth;
            this.y = Math.random() * canvasHeight;
            this.radius = isMobileDevice ? Math.random() * 1.5 + 1 : Math.random() * 2 + 1;
            this.vx = (Math.random() - 0.5) * (isMobileDevice ? 0.35 : 0.5);
            this.vy = (Math.random() - 0.5) * (isMobileDevice ? 0.35 : 0.5);
            this.colorIndex = Math.floor(Math.random() * 4);
          }

          update() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0) this.x = canvasWidth;
            if (this.x > canvasWidth) this.x = 0;
            if (this.y < 0) this.y = canvasHeight;
            if (this.y > canvasHeight) this.y = 0;

            if (hasFinePointer) {
              const dx = mouseX - this.x;
              const dy = mouseY - this.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 100) {
                const angle = Math.atan2(dy, dx);
                this.x -= Math.cos(angle) * 1.2;
                this.y -= Math.sin(angle) * 1.2;
              }
            }
          }

          draw() {
            const colors = getParticleColors();
            const color = colors[this.colorIndex % colors.length];
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          }
        }

        function initParticles() {
          particles = [];
          for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
          }
        }
        initParticles();

        function drawLines() {
          if (isMobileDevice) return; // Skip distance matrix on mobile for maximum fps
          const isLight = htmlEl.getAttribute("data-theme") === "light";
          const maxDistance = 110;
          for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
              const dx = particles[i].x - particles[j].x;
              const dy = particles[i].y - particles[j].y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < maxDistance) {
                const opacity = (1 - dist / maxDistance) * (isLight ? 0.15 : 0.2);
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = isLight ? `rgba(133, 57, 83, ${opacity})` : `rgba(220, 149, 255, ${opacity})`;
                ctx.lineWidth = 0.7;
                ctx.stroke();
              }
            }
          }
        }

        let animationFrameId;
        function renderParticles() {
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
          }
          drawLines();
          animationFrameId = requestAnimationFrame(renderParticles);
        }
        renderParticles();

        document.addEventListener("visibilitychange", () => {
          if (document.hidden) {
            cancelAnimationFrame(animationFrameId);
          } else {
            renderParticles();
          }
        });
      }

      // ------------------------------------------------------------------------
      // 6. Mobile Navigation Menu & Backdrop Toggle
      // ------------------------------------------------------------------------
      const mobileMenuBackdrop = document.getElementById("mobileMenuBackdrop");

      function closeMobileMenu() {
        if (navMenu) navMenu.classList.remove("open");
        if (mobileMenuBackdrop) mobileMenuBackdrop.classList.remove("active");
        if (mobileNavBtn) mobileNavBtn.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }

      function openMobileMenu() {
        if (navMenu) navMenu.classList.add("open");
        if (mobileMenuBackdrop) mobileMenuBackdrop.classList.add("active");
        if (mobileNavBtn) mobileNavBtn.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
      }

      if (mobileNavBtn && navMenu) {
        mobileNavBtn.addEventListener("click", function () {
          const isOpen = navMenu.classList.contains("open");
          if (isOpen) {
            closeMobileMenu();
          } else {
            openMobileMenu();
          }
        });

        if (mobileMenuBackdrop) {
          mobileMenuBackdrop.addEventListener("click", closeMobileMenu);
        }

        navLinks.forEach(link => {
          link.addEventListener("click", function () {
            navLinks.forEach(l => l.classList.remove("active"));
            this.classList.add("active");
            closeMobileMenu();
          });
        });
      }

      // ------------------------------------------------------------------------
      // 7. Scroll Progress Bar, Sticky Header & Scrollspy (Throttled via RAF)
      // ------------------------------------------------------------------------
      const sections = document.querySelectorAll("section[id]");
      const siteHeader = document.getElementById("siteHeader");

      function handleScroll() {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;

        if (scrollProgressBar && totalHeight > 0) {
          const progress = (scrollY / totalHeight) * 100;
          scrollProgressBar.style.width = `${progress}%`;
        }

        if (siteHeader) {
          if (scrollY > 25) {
            siteHeader.classList.add("scrolled");
          } else {
            siteHeader.classList.remove("scrolled");
          }
        }

        let currentSectionId = "";
        sections.forEach(current => {
          const sectionTop = current.offsetTop - 140;
          const sectionHeight = current.offsetHeight;
          if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
            currentSectionId = current.getAttribute("id");
          }
        });

        if (scrollY + window.innerHeight >= document.documentElement.scrollHeight - 60) {
          currentSectionId = "contact";
        }

        if (currentSectionId) {
          navLinks.forEach(link => {
            if (link.getAttribute("href") === "#" + currentSectionId) {
              link.classList.add("active");
            } else {
              link.classList.remove("active");
            }
          });
        }

        if (backToTopBtn) {
          if (scrollY > 350) {
            backToTopBtn.classList.add("visible");
          } else {
            backToTopBtn.classList.remove("visible");
          }
        }
      }

      let isScrollTicking = false;
      window.addEventListener("scroll", function () {
        if (!isScrollTicking) {
          window.requestAnimationFrame(function () {
            handleScroll();
            isScrollTicking = false;
          });
          isScrollTicking = true;
        }
      }, { passive: true });

      if (backToTopBtn) {
        backToTopBtn.addEventListener("click", function () {
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        });
      }

      // ------------------------------------------------------------------------
      // 8. Scroll Reveal Animations (IntersectionObserver)
      // ------------------------------------------------------------------------
      if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add("active");
              observer.unobserve(entry.target);
            }
          });
        }, {
          threshold: 0.04,
          rootMargin: "0px 0px -10px 0px"
        });

        revealElements.forEach(el => revealObserver.observe(el));
      } else {
        revealElements.forEach(el => el.classList.add("active"));
      }

      // Ensure hero elements are immediately visible on load
      const homeSection = document.getElementById("home");
      if (homeSection) {
        homeSection.querySelectorAll(".reveal").forEach(el => el.classList.add("active"));
      }

      // ------------------------------------------------------------------------
      // 9. Project Modal Preview
      // ------------------------------------------------------------------------
      function openProjectModal(name, desc) {
        if (modalTitle) modalTitle.textContent = name;
        if (modalDesc) modalDesc.textContent = desc;
        if (projectModal) {
          projectModal.classList.add("active");
          projectModal.setAttribute("aria-hidden", "false");
          document.body.style.overflow = "hidden";
        }
      }

      function closeProjectModal() {
        if (projectModal) {
          projectModal.classList.remove("active");
          projectModal.setAttribute("aria-hidden", "true");
          document.body.style.overflow = "";
        }
      }

      viewProjBtns.forEach(btn => {
        btn.addEventListener("click", function () {
          const name = this.getAttribute("data-project") || "Project Details";
          const desc = this.getAttribute("data-desc") || "Project overview and specifications.";
          openProjectModal(name, desc);
        });
      });

      if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeProjectModal);
      if (modalDismissBtn) modalDismissBtn.addEventListener("click", closeProjectModal);
      if (modalContactBtn) {
        modalContactBtn.addEventListener("click", function () {
          closeProjectModal();
        });
      }
      if (projectModal) {
        projectModal.addEventListener("click", function (e) {
          if (e.target === projectModal) {
            closeProjectModal();
          }
        });
      }

      // ------------------------------------------------------------------------
      // 10. Contact Form Client-Side Validation & Friendly Feedback
      // ------------------------------------------------------------------------
      if (contactForm) {
        contactForm.addEventListener("submit", function (e) {
          e.preventDefault();

          let isValid = true;
          const nameInput = document.getElementById("senderName");
          const emailInput = document.getElementById("senderEmail");
          const subjectInput = document.getElementById("messageSubject");
          const messageInput = document.getElementById("senderMessage");

          const nameGroup = document.getElementById("nameGroup");
          const emailGroup = document.getElementById("emailGroup");
          const subjectGroup = document.getElementById("subjectGroup");
          const messageGroup = document.getElementById("messageGroup");

          [nameGroup, emailGroup, subjectGroup, messageGroup].forEach(g => {
            if (g) g.classList.remove("has-error");
          });
          if (formSuccessAlert) formSuccessAlert.style.display = "none";

          if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
            if (nameGroup) nameGroup.classList.add("has-error");
            isValid = false;
          }

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailInput.value.trim() || !emailRegex.test(emailInput.value.trim())) {
            if (emailGroup) emailGroup.classList.add("has-error");
            isValid = false;
          }

          if (!subjectInput.value.trim()) {
            if (subjectGroup) subjectGroup.classList.add("has-error");
            isValid = false;
          }

          if (!messageInput.value.trim() || messageInput.value.trim().length < 10) {
            if (messageGroup) messageGroup.classList.add("has-error");
            isValid = false;
          }

          if (isValid) {
            if (formSuccessAlert) {
              formSuccessAlert.style.display = "flex";
              formSuccessAlert.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
            contactForm.reset();

            setTimeout(() => {
              if (formSuccessAlert) formSuccessAlert.style.display = "none";
            }, 8000);
          }
        });
      }

    })();
