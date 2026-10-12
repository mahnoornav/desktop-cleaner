import { getCurrentWindow } from "@tauri-apps/api/window";
import Widget from "./Widget";
import MainApp from "./MainApp";

function App() {
  const label = getCurrentWindow().label;
  return label === "app" ? <MainApp /> : <Widget />;
}

export default App;