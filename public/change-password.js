async function change() {
  const oldpass = document.getElementById("old");
  const newpass = document.getElementById("new");

  if (!oldpass || !newpass) return;

  const oldPassword = oldpass.value.trim();
  const newPassword = newpass.value.trim();

  if (!oldPassword || !newPassword) {
    openPopUp("Bitte beide Felder ausfüllen", "red");
    return;
  }

  try {
    const response = await fetch("/api/changePassword", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        oldPassword,
        newPassword,
      }),
    });

    const data = await response.json();

    if (data.status === "ok") {
      location.href = "/startseite";
      return;
    }

    if (data.status === "incorect password") {
      openPopUp("Altes Passwort ist falsch", "red");
    } else if (data.status === "same password") {
      openPopUp("Neues Passwort muss anders sein", "orange");
    } else if (data.status === "invalid") {
      openPopUp("Bitte gültige Werte eingeben", "red");
    } else if (data.status === "no accound") {
      openPopUp("Bitte erneut einloggen", "red");
    } else {
      openPopUp("Fehler beim Ändern", "red");
    }
  } catch (error) {
    console.error(error);
    openPopUp("Serverfehler", "red");
  }
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
