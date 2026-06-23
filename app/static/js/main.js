/**
 * Add a new button entry to the form
 */
function addButton() {
    const container = document.getElementById("buttons-container");
    const entries = container.querySelectorAll(".button-entry");
    const index = entries.length;

    const entry = document.createElement("div");
    entry.className = "button-entry";
    entry.dataset.index = index;

    entry.innerHTML = `
        <div class="button-entry-header">
            <span class="button-number">Botão ${index + 1}</span>
            <div class="button-order-actions">
                <button type="button" class="btn btn-xs btn-outline" onclick="moveButton(this, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="btn btn-xs btn-outline" onclick="moveButton(this, 1)" disabled>↓</button>
                <button type="button" class="btn btn-xs btn-danger" onclick="removeButton(this)">✕</button>
            </div>
        </div>
        <div class="button-fields">
            <div class="form-group">
                <label>Título</label>
                <input type="text" name="btn_title" placeholder="Ex: WhatsApp" required>
            </div>
            <div class="form-group">
                <label>URL</label>
                <input type="url" name="btn_url" placeholder="Ex: https://wa.me/554899999999" required>
            </div>
            <div class="form-group">
                <label>Tipo</label>
                <select name="btn_type" required>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="maps">Maps</option>
                    <option value="website">Website</option>
                    <option value="phone">Phone</option>
                    <option value="booking">Booking</option>
                    <option value="menu">Menu</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
        </div>
    `;

    container.appendChild(entry);
    updateButtonNumbers();
}

/**
 * Remove a button entry from the form
 */
function removeButton(btn) {
    const entry = btn.closest(".button-entry");
    if (entry) {
        entry.remove();
        updateButtonNumbers();
    }
}

/**
 * Move a button up or down
 */
function moveButton(btn, direction) {
    const entry = btn.closest(".button-entry");
    const container = document.getElementById("buttons-container");

    if (direction === -1 && entry.previousElementSibling) {
        container.insertBefore(entry, entry.previousElementSibling);
    } else if (direction === 1 && entry.nextElementSibling) {
        container.insertBefore(entry.nextElementSibling, entry);
    }

    updateButtonNumbers();
}

/**
 * Update button numbers and toggle move buttons
 */
function updateButtonNumbers() {
    const container = document.getElementById("buttons-container");
    const entries = container.querySelectorAll(".button-entry");
    const total = entries.length;

    entries.forEach((entry, index) => {
        const numberSpan = entry.querySelector(".button-number");
        if (numberSpan) {
            numberSpan.textContent = `Botão ${index + 1}`;
        }

        const upBtn = entry.querySelector('.button-order-actions .btn-outline:first-child');
        const downBtn = entry.querySelector('.button-order-actions .btn-outline:last-child');

        if (upBtn) {
            upBtn.disabled = index === 0;
        }
        if (downBtn) {
            downBtn.disabled = index === total - 1;
        }
    });
}

/**
 * Slug preview - auto-fill slug from name
 */
document.addEventListener("DOMContentLoaded", function () {
    const nameInput = document.getElementById("name");
    const slugInput = document.getElementById("slug");

    if (nameInput && slugInput) {
        let slugEdited = false;

        slugInput.addEventListener("input", function () {
            slugEdited = true;
            updateSlugPreview();
        });

        nameInput.addEventListener("input", function () {
            if (!slugEdited) {
                slugInput.value = slugify(nameInput.value);
                updateSlugPreview();
            }
        });
    }

    updateSlugPreview();
});

function slugify(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function updateSlugPreview() {
    const slugInput = document.getElementById("slug") || document.getElementById("new_slug");
    const preview = document.getElementById("slug-preview");
    if (slugInput && preview) {
        preview.textContent = slugInput.value || "slug-da-empresa";
    }
}
