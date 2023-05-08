import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import MapViewerApp from "./mapviewer/MapViewer";
import reportWebVitals from "./reportWebVitals";
import { Compression } from "./client/util/Compression";
import registerServiceWorker from "./registerServiceWorker";

window.wallpaperPropertyListener = {
    applyGeneralProperties: (properties: any) => {
        if (properties.fps) {
            window.wallpaperFpsLimit = properties.fps;
        }
    },
};

// console.log('start index', performance.now());
Compression.initWasm();

ReactDOM.render(
    <React.StrictMode>
        <BrowserRouter>
            <MapViewerApp />
        </BrowserRouter>
    </React.StrictMode>,
    document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// registerServiceWorker();
