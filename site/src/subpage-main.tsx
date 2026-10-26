import { hydrateRoot } from "react-dom/client";
import { SubPage, type PageName } from "./SubPage";
import "./styles/index.css";

const root = document.getElementById("root")!;
hydrateRoot(root, <SubPage name={root.dataset.page as PageName} />);
