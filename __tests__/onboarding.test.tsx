import { act, fireEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

const APP = "./src/app";
const YEAR = new Date().getFullYear();

async function type(label: string, text: string) {
  const el = await screen.findByLabelText(label);
  await act(async () => {
    fireEvent.changeText(el, text);
  });
}

async function fillCommonFields() {
  await type("Username", "newperson");
  await type("Bio", "Here to find out what I actually think.");
}

async function fillBirthday(day: string, month: string, year: string) {
  await type("Birth day", day);
  await type("Birth month", month);
  await type("Birth year", year);
}

async function press(text: string) {
  await act(async () => {
    fireEvent.press(screen.getByText(text));
  });
}

describe("onboarding", () => {
  it("gates the app behind username, birthday, and bio", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    expect(await screen.findByLabelText("Username")).toBeTruthy();
    expect(screen.getByLabelText("Birth day")).toBeTruthy();
    expect(screen.getByLabelText("Bio")).toBeTruthy();
  });

  it("rejects a birthday under 16", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await fillCommonFields();
    await fillBirthday("15", "06", String(YEAR - 10));

    await press("Continue");

    expect(await screen.findByText(/you need to be 16 or older/i)).toBeTruthy();
    expect(screen.queryByLabelText("Username")).toBeNull();
  });

  it("lets a valid birthday through and clears the gate", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await fillCommonFields();
    await fillBirthday("15", "06", String(YEAR - 25));

    await press("Continue");

    expect(screen.queryByLabelText("Username")).toBeNull();
    expect(screen.queryByText(/you need to be 16 or older/i)).toBeNull();
  });

  it("rejects an impossible calendar date", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await fillCommonFields();
    await fillBirthday("30", "02", String(YEAR - 25));

    expect(await screen.findByText(/enter a valid birth date/i)).toBeTruthy();
  });
});
