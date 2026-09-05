import { test, expect } from "./fixtures/auth.fixture";

test.describe("Settings and About Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/rest/v1/workspaces*", async (route) => {
      await route.fulfill({
        status: 200,
        json: [{ id: "workspace-1", name: "Personal Workspace", owner_id: "test-user-id" }]
      });
    });

    await page.route("**/rest/v1/profiles*", async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: "test-user-id", name: "Test User", email: "test@lumena.app", avatar_url: null }
      });
    });
  });

  test("settings page loads and renders profile tab by default", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Settings|Configuración/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Profile|Perfil/i })).toBeVisible();
  });

  test("about tab displays clean app info without backend diagnostics or infrastructure statuses", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const aboutTabBtn = page.getByRole("button", { name: /About|Acerca de/i });
    await expect(aboutTabBtn).toBeVisible();
    await aboutTabBtn.click();

    // Must show Lumena Workspace and Alpha version
    await expect(page.getByRole("heading", { name: "Lumena Workspace", exact: true })).toBeVisible();
    await expect(page.getByText("Version 0.2.0 (Alpha)")).toBeVisible();

    // Must show terms & support links
    await expect(page.getByText("Terms of Service")).toBeVisible();
    await expect(page.getByText("Privacy Policy")).toBeVisible();
    await expect(page.getByText(/Contact Support|Contactar Soporte/i)).toBeVisible();

    // Must NOT show DB/AI diagnostics or legacy version markers
    await expect(page.getByText(/Database Status|Estado de la Base de Datos/i)).not.toBeVisible();
    await expect(page.getByText(/AI Engine Integration|Integración del Motor de IA/i)).not.toBeVisible();
    await expect(page.getByText(/Premium Active|Premium Activo/i)).not.toBeVisible();
    await expect(page.getByText(/Phase 11/i)).not.toBeVisible();
    await expect(page.getByText(/1\.0\.0-rc/i)).not.toBeVisible();
  });
});
