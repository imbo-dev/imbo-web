import { renderToString } from "react-dom/server";
import { App } from "./App";
import { SubPage, type PageName } from "./SubPage";

export function render() {
  return renderToString(<App />);
}

export function renderPage(name: PageName) {
  return renderToString(<SubPage name={name} />);
}
