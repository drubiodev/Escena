// Ladrillos import
import
{
    configure,
    registerComponent,
} from "https://cdn.jsdelivr.net/npm/ladrillosjs@2.1.3/dist/index.js";

function fitSlide(slideZoom, editorWorkspace)
{
    const scale = Math.min(
        editorWorkspace.clientWidth / 1280,
        editorWorkspace.clientHeight / 720
    );
    slideZoom.style.transform = `scale(${scale})`;
    slideZoom.style.left = (editorWorkspace.clientWidth - 1280 * scale) / 2 + "px";
    slideZoom.style.top = (editorWorkspace.clientHeight - 720 * scale) / 2 + "px";
}

export async function boot()
{
    // Cache parsed component templates to avoid fetching and processing them again.
    configure({ cacheSize: 10 });
    await registerComponent("heading-block", "./blocks/heading", true);

    const frame = document.createElement("div");
    frame.className = "frame";

    const heading = document.createElement("heading-block");
    heading.setAttribute("text", "Test Heading");
    heading.setAttribute("size", "76");

    frame.appendChild(heading);
    document.querySelector(".slide-page").appendChild(frame);

    const resize = () => fitSlide(
        document.querySelector(".slide-zoom"),
        document.querySelector(".editor-workspace")
    );

    window.addEventListener("resize", resize);
    resize();
}