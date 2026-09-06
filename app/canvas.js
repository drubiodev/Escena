import { $listen } from "ladrillosjs";
import { registry, SLIDE_HEIGHT, SLIDE_WIDTH } from "./registry.js";
import
{
    createBlockEl,
    createFrame,
    styleFrame,
} from "./renderer.js";
import { store } from "./store.js";

const GRID_SIZE = 8;
const SNAP_TOLERANCE = 7;
const SLIDE_MARGIN = 64;

/** Mounts canvas rendering and interactions into the slide editor component. */
export function mount($host, $refs)
{
    const {
        wrap,
        slideZoom,
        slidePage,
        interactionLayer,
        selection,
        guideV,
        guideH,
        readout,
    } = $refs;

    /** Scales and centers the fixed slide inside the component host. */
    function fitSlide()
    {
        const scale = Math.min(
            wrap.clientWidth / SLIDE_WIDTH,
            wrap.clientHeight / SLIDE_HEIGHT
        );

        slideZoom.style.transform = `scale(${scale})`;
        slideZoom.style.left =
            (wrap.clientWidth - SLIDE_WIDTH * scale) / 2 + "px";
        slideZoom.style.top =
            (wrap.clientHeight - SLIDE_HEIGHT * scale) / 2 + "px";
        paintSelection();
    }

    /**
     * Converts viewport pointer coordinates into fixed slide coordinates.
     * @param {number} clientX Horizontal viewport coordinate in screen pixels.
     * @param {number} clientY Vertical viewport coordinate in screen pixels.
     * @returns {{x: number, y: number}} Position in logical slide pixels.
     */
    function toLogical(clientX, clientY)
    {
        const rect = slidePage.getBoundingClientRect();
        // The rendered width reveals how many screen pixels equal one logical pixel.
        const scale = rect.width / SLIDE_WIDTH;
        return {
            // Shift from viewport origin to slide origin, then remove visual scaling.
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale,
        };
    }

    const resizeObserver = new ResizeObserver(fitSlide);
    resizeObserver.observe(wrap);
    fitSlide();

    const frames = new Map();

    /** Updates existing frames while preserving DOM identity for unchanged blocks. */
    function reconcile()
    {
        const slide = store.slide();
        const visibleIds = new Set();

        slidePage.dataset.theme = store.theme();
        slidePage.style.background = slide.background || "";

        for (const block of slide.blocks)
        {
            visibleIds.add(block.id);
            let frame = frames.get(block.id);

            if (!frame)
            {
                frame = createFrame(block);
                frame.dataset.props = JSON.stringify(block.props || {});
                frames.set(block.id, frame);
                slidePage.appendChild(frame);
            }

            styleFrame(frame, block);
            const props = JSON.stringify(block.props || {});
            if (frame.dataset.props !== props)
            {
                frame.dataset.props = props;
                frame.replaceChildren(createBlockEl(block));
            }
        }

        for (const [id, frame] of frames)
        {
            if (visibleIds.has(id)) continue;
            frame.remove();
            frames.delete(id);
        }

        paintSelection(store.selected());
    }

    $listen("escena:change", reconcile);
    reconcile();

    /** Positions the unscaled selection outline over the selected block. */
    function paintSelection(block = store.selected())
    {
        if (!block)
        {
            selection.classList.remove("is-visible");
            return;
        }

        const slideRect = slidePage.getBoundingClientRect();
        const layerRect = interactionLayer.getBoundingClientRect();
        const scale = slideRect.width / SLIDE_WIDTH;

        selection.classList.add("is-visible");
        selection.style.left = slideRect.left - layerRect.left + block.x * scale + "px";
        selection.style.top = slideRect.top - layerRect.top + block.y * scale + "px";
        selection.style.width = block.w * scale + "px";
        selection.style.height = block.h * scale + "px";
    }

    slidePage.addEventListener("pointerdown", (event) =>
    {
        const frame = event.target.closest?.(".frame");
        if (!frame)
        {
            store.select(null);
            return;
        }

        store.select(frame.dataset.id);
        const interactive = event.composedPath().some((target) =>
            target.matches?.("video, audio, button, input, select, textarea, a")
        );
        if (interactive) return;
        beginPointerAction(event, "move");
    });

    let pointerAction = null;
    const MIN_BLOCK_SIZE = 32;

    /** Starts a move or resize from the selected block's current geometry. */
    function beginPointerAction(event, mode, direction = "")
    {
        const block = store.selected();
        if (!block) return;

        pointerAction = {
            id: block.id,
            mode,
            direction,
            startClientX: event.clientX,
            startClientY: event.clientY,
            origin: { x: block.x, y: block.y, w: block.w, h: block.h },
            next: { x: block.x, y: block.y, w: block.w, h: block.h },
            moved: false,
        };

        window.addEventListener("pointermove", previewPointerAction);
        window.addEventListener("pointerup", finishPointerAction, { once: true });
        event.preventDefault();
    }

    /** Paints geometry directly so pointer movement does not mutate the document. */
    function previewPointerAction(event)
    {
        if (!pointerAction) return;

        const scale = slidePage.getBoundingClientRect().width / SLIDE_WIDTH;
        const deltaX = (event.clientX - pointerAction.startClientX) / scale;
        const deltaY = (event.clientY - pointerAction.startClientY) / scale;
        const origin = pointerAction.origin;
        let next;

        if (pointerAction.mode === "move")
        {
            const block = store.block(pointerAction.id);
            const snapped = snapPosition(
                block,
                origin.x + deltaX,
                origin.y + deltaY,
                event.altKey
            );
            next = { ...origin, x: snapped.x, y: snapped.y };
            paintGuide(guideV, snapped.guideX, "x");
            paintGuide(guideH, snapped.guideY, "y");
        }
        else
        {
            next = resizeGeometry(origin, pointerAction.direction, deltaX, deltaY);
        }

        pointerAction.next = next;
        pointerAction.moved = true;
        const frame = frames.get(pointerAction.id);
        if (frame) styleFrame(frame, { ...store.block(pointerAction.id), ...next });
        paintSelection({ ...store.block(pointerAction.id), ...next });
    }

    /** Commits exactly one geometry change after the pointer is released. */
    function finishPointerAction()
    {
        window.removeEventListener("pointermove", previewPointerAction);
        if (pointerAction?.moved)
            store.moveBlock(pointerAction.id, pointerAction.next);
        paintGuide(guideV, null, "x");
        paintGuide(guideH, null, "y");
        pointerAction = null;
    }

    /** Returns resized geometry for the edges named by a handle direction. */
    function resizeGeometry(origin, direction, deltaX, deltaY)
    {
        let { x, y, w, h } = origin;

        if (direction.includes("e")) w += deltaX;
        if (direction.includes("s")) h += deltaY;
        if (direction.includes("w"))
        {
            w -= deltaX;
            x += deltaX;
        }
        if (direction.includes("n"))
        {
            h -= deltaY;
            y += deltaY;
        }

        if (w < MIN_BLOCK_SIZE)
        {
            if (direction.includes("w")) x -= MIN_BLOCK_SIZE - w;
            w = MIN_BLOCK_SIZE;
        }
        if (h < MIN_BLOCK_SIZE)
        {
            if (direction.includes("n")) y -= MIN_BLOCK_SIZE - h;
            h = MIN_BLOCK_SIZE;
        }

        return {
            x: Math.round(x),
            y: Math.round(y),
            w: Math.round(w),
            h: Math.round(h),
        };
    }

    interactionLayer.addEventListener("pointerdown", (event) =>
    {
        const handle = event.target.closest?.(".handle");
        if (handle)
            beginPointerAction(event, "resize", handle.dataset.dir);
    });

    /** Returns slide and sibling alignment targets for one axis. */
    function alignmentTargets(axis, movingId)
    {
        const slideSize = axis === "x" ? SLIDE_WIDTH : SLIDE_HEIGHT;
        const targets = [
            0,
            SLIDE_MARGIN,
            slideSize / 2,
            slideSize - SLIDE_MARGIN,
            slideSize,
        ];

        for (const block of store.slide().blocks)
        {
            if (block.id === movingId) continue;
            const start = axis === "x" ? block.x : block.y;
            const size = axis === "x" ? block.w : block.h;
            targets.push(start, start + size / 2, start + size);
        }

        return targets;
    }

    /** Finds the smallest movement that aligns one block edge to a target. */
    function snapEdge(position, size, targets)
    {
        const edges = [position, position + size / 2, position + size];
        let best = null;

        for (const edge of edges)
        {
            for (const target of targets)
            {
                const delta = target - edge;
                if (Math.abs(delta) > SNAP_TOLERANCE) continue;
                if (!best || Math.abs(delta) < Math.abs(best.delta))
                    best = { delta, guide: target };
            }
        }

        return best
            ? { position: position + best.delta, guide: best.guide }
            : { position, guide: null };
    }

    /** Snaps a moving block unless Alt/Option requests free movement. */
    function snapPosition(block, x, y, bypass)
    {
        if (bypass) return { x, y, guideX: null, guideY: null };

        const horizontal = snapEdge(
            x,
            block.w,
            alignmentTargets("x", block.id)
        );
        const vertical = snapEdge(
            y,
            block.h,
            alignmentTargets("y", block.id)
        );

        return {
            x: horizontal.guide == null
                ? Math.round(x / GRID_SIZE) * GRID_SIZE
                : horizontal.position,
            y: vertical.guide == null
                ? Math.round(y / GRID_SIZE) * GRID_SIZE
                : vertical.position,
            guideX: horizontal.guide,
            guideY: vertical.guide,
        };
    }

    /** Shows one alignment guide at a logical slide coordinate. */
    function paintGuide(guide, coordinate, axis)
    {
        if (coordinate == null)
        {
            guide.classList.remove("is-visible");
            return;
        }

        const slideRect = slidePage.getBoundingClientRect();
        const layerRect = interactionLayer.getBoundingClientRect();
        const scale = slideRect.width / SLIDE_WIDTH;
        guide.classList.add("is-visible");
        if (axis === "x")
            guide.style.left = slideRect.left - layerRect.left + coordinate * scale + "px";
        else
            guide.style.top = slideRect.top - layerRect.top + coordinate * scale + "px";
    }

    slidePage.addEventListener("dblclick", (event) =>
    {
        const frame = event.target.closest?.(".frame");
        const block = frame && store.block(frame.dataset.id);
        const definition = block && registry.get(block.type);
        if (!definition?.editable) return;

        const blockElement = frame.firstElementChild;
        const editable = (blockElement.shadowRoot || blockElement)
            .querySelector("[data-editable]");
        if (!editable) return;

        let save = true;
        editable.setAttribute("contenteditable", "plaintext-only");
        editable.focus();

        const finish = () =>
        {
            editable.removeAttribute("contenteditable");
            if (save)
                store.setBlockProp(block.id, definition.editable, editable.innerText.trim());
            else
                reconcile();
        };

        editable.addEventListener("keydown", (keyEvent) =>
        {
            keyEvent.stopPropagation();
            if (keyEvent.key === "Escape")
            {
                keyEvent.preventDefault();
                save = false;
                editable.blur();
            }
            if (keyEvent.key === "Enter" && (keyEvent.metaKey || keyEvent.ctrlKey))
            {
                keyEvent.preventDefault();
                editable.blur();
            }
        });
        editable.addEventListener("blur", finish, { once: true });
    });

    const BLOCK_DRAG_TYPE = "application/x-escena-block";

    wrap.addEventListener("dragover", (event) =>
    {
        if (!event.dataTransfer.types.includes(BLOCK_DRAG_TYPE)) return;
        event.preventDefault();
        wrap.classList.add("is-drop-target");
    });

    wrap.addEventListener("dragleave", () =>
    {
        wrap.classList.remove("is-drop-target");
    });

    wrap.addEventListener("drop", (event) =>
    {
        wrap.classList.remove("is-drop-target");
        const type = event.dataTransfer.getData(BLOCK_DRAG_TYPE);
        if (!registry.has(type)) return;

        event.preventDefault();
        const point = toLogical(event.clientX, event.clientY);
        store.addBlock(type, point.x, point.y);
    });

}
