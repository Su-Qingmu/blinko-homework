import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// 配置 Iconify 使用国内镜像，避免在网络受限时 fallback 警告
(window as any).IconifyProviders = {
  '': {
    resources: ['https://api.iconify.design'],
    path: '/{prefix}.json',
  },
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
