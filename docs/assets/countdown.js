const countdown = document.querySelector("[data-countdown]");

if (countdown) {
  const target = Date.parse(countdown.dataset.target);
  const days = countdown.querySelector("[data-days]");
  const hours = countdown.querySelector("[data-hours]");
  const minutes = countdown.querySelector("[data-minutes]");
  const seconds = countdown.querySelector("[data-seconds]");
  const intro = countdown.querySelector(".countdown-intro > p:last-child");

  const updateCountdown = () => {
    const remaining = target - Date.now();

    if (remaining <= 0) {
      days.textContent = "00";
      hours.textContent = "00";
      minutes.textContent = "00";
      seconds.textContent = "00";
      intro.textContent = "Het weekend is begonnen!";
      return false;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    days.textContent = String(Math.floor(totalSeconds / 86400)).padStart(3, "0");
    hours.textContent = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
    minutes.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    seconds.textContent = String(totalSeconds % 60).padStart(2, "0");
    return true;
  };

  if (Number.isFinite(target) && days && hours && minutes && seconds && intro && updateCountdown()) {
    const interval = window.setInterval(() => {
      if (!updateCountdown()) window.clearInterval(interval);
    }, 1000);
  }
}
