// Подписка на рассылку — отправка в Kit без перезагрузки страницы
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".news-form").forEach(form => {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const card    = form.closest(".news-card");
            const okMsg   = card.querySelector(".news-msg--ok");
            const errMsg  = card.querySelector(".news-msg--err");
            const btn     = form.querySelector(".news-btn");
            const input   = form.querySelector("input[type=email]");
            const consent = form.querySelector("input[type=checkbox]");
            const trap    = form.querySelector(".news-trap");

            // Ловушка для ботов: поле скрыто, люди его не заполняют
            if (trap && trap.value) return;

            if (consent && !consent.checked) {
                consent.focus();
                return;
            }

            errMsg.hidden = true;
            const label = btn.textContent;
            btn.disabled = true;
            btn.textContent = "…";

            // Отправляем только то, что ждёт Kit
            const fd = new FormData();
            fd.append("email_address", input.value.trim());
            fd.append("fields[language]", localStorage.getItem("lang") || "pl");

            const fail = () => {
                errMsg.hidden = false;
                btn.disabled = false;
                btn.textContent = label;
            };

            try {
                const res  = await fetch(form.action, {
                    method: "POST",
                    body: fd,
                    headers: { "Accept": "application/json" }
                });
                const data = await res.json().catch(() => ({}));

                if (res.ok && data.status !== "error") {
                    form.hidden = true;
                    okMsg.hidden = false;
                } else {
                    fail();
                }
            } catch (err) {
                fail();
            }
        });
    });
});
