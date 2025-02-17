import { useEffect, useRef, useState } from "react";
import Navbar from "../../components/layout/editor/Navbar";
import { ActiveElement, Attributes } from "../../types/IEditorProps";
import Live from "../../components/Live";
import { Canvas, FabricObject } from "fabric";
import { useMutation, useRedo, useStorage, useUndo } from "@liveblocks/react/suspense";
import { handleDelete, handleKeyDown } from "../../lib/key-events";
import { defaultNavElement } from "../../utils";
import { handleImageUpload } from "../../lib/shapes";
import {
  handleCanvaseMouseMove, handleCanvasMouseDown,
  handleCanvasMouseUp, handleCanvasObjectModified, handleCanvasObjectScaling, handleCanvasSelectionCreated, handleCanvasZoom, handlePathCreated, handleResize, initializeFabric,
  renderCanvas
} from "../../lib/canvas";
import RightSidebar from "../../components/layout/editor/RightSidebar";
import LeftSidebar from "../../components/layout/editor/LeftSidebar";
import { LiveMap } from "@liveblocks/client";

export default function Editor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);

  const isDrawing = useRef(false);
  const shapeRef = useRef<FabricObject | null>(null);
  const selectedShapeRef = useRef<string | null>(null);
  const activeObjectRef = useRef<FabricObject | null>(null);
  const isEditingRef = useRef(false);
  const canvasObjects = useStorage((root) => root.canvasObjects as LiveMap<string, any>); // Add correct type here
  const imageInputRef = useRef<HTMLInputElement>(null);
  const undo = useUndo();
  const redo = useRedo();

  const syncShapeInStorage = useMutation(({ storage }, object) => {
    if (!object) return;
    const { objectId } = object;
    const shapeData = object.toJSON();
    shapeData.objectId = objectId;

    const canvasObjects = storage.get("canvasObjects") as LiveMap<string, any>; // Add correct type here
    canvasObjects?.set(objectId, shapeData);
  }, []);

  const [elementAttributes, setElementAttributes] = useState<Attributes>({
    width: "",
    height: "",
    rx: "",
    ry: "",
    fontSize: "",
    fontFamily: "",
    fontWeight: "",
    fill: "#fff",
    stroke: "#fff",
  });

  const [activeElement, setActiveElement] = useState<ActiveElement>({
    name: "",
    value: "",
    icon: "",
  });

  const handleActiveElement = (elem: ActiveElement) => {
    setActiveElement(elem);

    switch (elem?.value) {
      case "reset":
        deleteAllShapes();
        fabricRef.current?.clear();
        setActiveElement(defaultNavElement);
        break;
      case "delete":
        handleDelete(fabricRef.current as any, deleteShapeFromStorage);
        setActiveElement(defaultNavElement);
        break;
      case "image":
        imageInputRef.current?.click();
        isDrawing.current = false;
        if (fabricRef.current) {
          fabricRef.current.isDrawingMode = false;
        }
        break;
      case "comments":
        break;
      default:
        selectedShapeRef.current = elem?.value as string;
        break;
    }
  };

  const deleteShapeFromStorage = useMutation(({ storage }, shapeId) => {
    const canvasObjects = storage.get("canvasObjects") as LiveMap<string, any>; // Add correct type here
    canvasObjects?.delete(shapeId);
  }, []);

  const deleteAllShapes = useMutation(({ storage }) => {
    const canvasObjects = storage.get("canvasObjects") as LiveMap<string, any>; // Add correct type here
    if (!canvasObjects || canvasObjects.size === 0) return true;
    for (const [key] of canvasObjects.entries()) {
      canvasObjects.delete(key);
    }
    return canvasObjects.size === 0;
  }, []);



  const initializeAndRenderCanvas = () => {
    const canvas = initializeFabric({ canvasRef, fabricRef });


    //! Controllers and objects add + events 
    const handleMouseDown = (options: any) => {
      handleCanvasMouseDown({
        options,
        canvas,
        selectedShapeRef,
        isDrawing,
        shapeRef,
      });
    };

    const handleMouseMove = (options: any) => {
      handleCanvaseMouseMove({
        options,
        canvas,
        isDrawing,
        selectedShapeRef,
        shapeRef,
        syncShapeInStorage,
      });
    };

    const handleMouseUp = () => {
      handleCanvasMouseUp({
        canvas,
        isDrawing,
        shapeRef,
        activeObjectRef,
        selectedShapeRef,
        syncShapeInStorage,
        setActiveElement,
      });
    };


    //! Events 
    const handlePathCreatedEvent = (options: any) => {
      handlePathCreated({
        options,
        syncShapeInStorage,
      });
    };

    const handleObjectModifiedEvent = (options: any) => {
      handleCanvasObjectModified({
        options,
        syncShapeInStorage,
      });
    };


    // canvas.on("object:moving", handleObjectMovingEvent);
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("path:created", handlePathCreatedEvent);
    canvas.on("object:modified", handleObjectModifiedEvent);

    canvas.on("selection:created", (options: any) => {
      handleCanvasSelectionCreated({
        options,
        isEditingRef,
        setElementAttributes,
      });
    });

    canvas.on("object:scaling", (options: any) => {
      handleCanvasObjectScaling({
        options,
        setElementAttributes,
      });
    });

    canvas.on("mouse:wheel", (options: any) => {
      handleCanvasZoom({
        options,
        canvas,
      });
    });



    const resizeHandler = () => {
      handleResize({
        canvas: fabricRef.current,
      });
    };

    const keyDownHandler = (e: KeyboardEvent) => {
      handleKeyDown({
        e,
        canvas: fabricRef.current,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });
    };


    return () => {
      canvas.dispose();
      window.removeEventListener("resize", resizeHandler);
      window.removeEventListener("keydown", keyDownHandler);
    };
  };



  useEffect(() => {
    const disposeCanvas = initializeAndRenderCanvas();
    return () => {
      disposeCanvas();
    };
  }, [canvasRef]);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.backgroundColor = "#1E1E1E";
    }

    renderCanvas({
      fabricRef,
      canvasObjects,
      activeObjectRef,
    });

  }, [canvasObjects]);





  return (
    <>
      <main className="h-screen w-screen overflow-hidden">
        <Navbar
          activeElement={activeElement}
          imageInputRef={imageInputRef}
          handleImageUpload={(e: any) => {
            e.stopPropagation();
            handleImageUpload({
              file: e.target.files[0],
              canvas: fabricRef as any,
              shapeRef,
              syncShapeInStorage,
            });
          }}
          handleActiveElement={handleActiveElement}
        />

        <section className="flex h-full flex-row">
          <LeftSidebar allShapes={Array.from(canvasObjects.entries())} />
          <Live canvasRef={canvasRef} undo={undo} redo={redo} />
          <RightSidebar
            elementAttributes={elementAttributes}
            setElementAttributes={setElementAttributes}
            fabricRef={fabricRef}
            activeObjectRef={activeObjectRef}
            isEditingRef={isEditingRef}
            syncShapeInStorage={syncShapeInStorage}
          />
        </section>
      </main>
    </>
  );
}
