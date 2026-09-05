/* =========================================
   PUBG Writer Landing → App
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const landingPage = document.getElementById("landingPage");
    const appPage = document.getElementById("appPage");

    const startButton = document.getElementById("startButton");
    const backButton = document.getElementById("backButton");


    // 사용해보기
    if (startButton) {

        startButton.addEventListener("click", () => {

            landingPage.classList.add("hidden");
            appPage.classList.remove("hidden");

            window.scrollTo({
                top: 0,
                behavior: "instant"
            });

        });

    }


    // 뒤로가기
    if (backButton) {

        backButton.addEventListener("click", () => {

            appPage.classList.add("hidden");
            landingPage.classList.remove("hidden");

            window.scrollTo({
                top: 0,
                behavior: "instant"
            });

        });

    }

});
