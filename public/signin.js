function signin() {
  const name = document.getElementById("name");
  const password = document.getElementById("password");
  const subtitle = document.getElementById("subtitle");
  const loadin_screen = document.getElementById("loading");

  loadin_screen.style.display = "flex";
  fetch("/api/signin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: name.value,
      password: password.value,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      const status = data.status;

      if (status == "ok") {
        location.href = "/startseite";
      } else if (status == "user exists") {
        loadin_screen.style.display = "none";
        subtitle.innerHTML = "user existiert bereits";
        subtitle.style.color = "red";
        name.value = "";
        password.value = "";
        setTimeout(() => {
          subtitle.innerHTML = "Sign in";
          subtitle.style.color = "black";
        }, 1000);
      }
    });
}

function openPopUp(text, color = "gray", time = 1500) {
  const popup = document.createElement("div");
  popup.classList.add("pop-up");
  popup.innerHTML = text;
  popup.style.background = color;

  const container = document.body || document.documentElement;
  container.appendChild(popup);

  setTimeout(() => {
    popup.classList.add("open");
  }, 100);

  setTimeout(() => {
    popup.classList.remove("open");
    setTimeout(() => {
      popup.remove();
    }, 500);
  }, time + 100);
}
