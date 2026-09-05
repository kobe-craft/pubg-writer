/* =====================================================
   PUBG WRITER LANDING
===================================================== */

window.startWriter = function () {

    const landingPage =
        document.getElementById("landingPage");

    const appPage =
        document.getElementById("appPage");

    if (!landingPage || !appPage) return;

    landingPage.classList.add("leaving");

    setTimeout(() => {

        landingPage.classList.add("hidden");

        appPage.classList.remove("hidden");

        requestAnimationFrame(() => {
            appPage.classList.add("visible");
        });

        window.scrollTo(0, 0);

    }, 450);
};


window.showLanding = function () {

    const landingPage =
        document.getElementById("landingPage");

    const appPage =
        document.getElementById("appPage");

    if (!landingPage || !appPage) return;

    appPage.classList.remove("visible");

    setTimeout(() => {

        appPage.classList.add("hidden");

        landingPage.classList.remove("hidden");
        landingPage.classList.remove("leaving");

        requestAnimationFrame(() => {
            landingPage.classList.add("returning");
        });

        setTimeout(() => {
            landingPage.classList.remove("returning");
        }, 800);

        window.scrollTo(0, 0);

    }, 350);
};
