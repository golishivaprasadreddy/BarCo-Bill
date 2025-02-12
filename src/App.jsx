import React, { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

const BarcodeScannerApp = () => {
  const videoRef = useRef(null);
  const [scanner, setScanner] = useState(null);
  const [items, setItems] = useState([]);
  const [transactionId, setTransactionId] = useState(generateTransactionId());
  const [cameraStarted, setCameraStarted] = useState(false);
  let controls = useRef(null);

  useEffect(() => {
    setTransactionId(generateTransactionId());
    const codeReader = new BrowserMultiFormatReader();
    setScanner(codeReader);
    return () => stopScanner();
  }, []);

  const startScanner = async () => {
    try {
      if (!videoRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoRef.current.srcObject = stream;
      setCameraStarted(true);

      controls.current = scanner.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err) => {
          if (result) handleScannedItem(result.text);
        }
      );
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Camera access denied. Please allow camera permissions.");
    }
  };

  const stopScanner = () => {
    if (controls.current) {
      controls.current.stop();
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setCameraStarted(false);
  };

  const handleScannedItem = async (barcode) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.barcode === barcode);
      if (existingItem) {
        return prevItems.map((item) =>
          item.barcode === barcode ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [{ barcode, name: "Fetching...", image: null, price: 0, quantity: 1 }, ...prevItems];
      }
    });

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();

      if (data.status === 1) {
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.barcode === barcode
              ? {
                  ...item,
                  name: data.product.product_name || "Unknown Product",
                  image: data.product.image_url || null,
                  price: generatePrice(),
                }
              : item
          )
        );
      } else {
        alert("Product not found. Please enter manually.");
      }
    } catch (error) {
      console.error("Error fetching product:", error);
    }
  };

  const deleteItem = (barcode) => {
    setItems((prevItems) => prevItems.filter((item) => item.barcode !== barcode));
  };

  const handlePriceChange = (barcode, newPrice) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.barcode === barcode ? { ...item, price: newPrice } : item))
    );
  };

  const handleQuantityChange = (barcode, newQuantity) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.barcode === barcode ? { ...item, quantity: newQuantity } : item))
    );
  };

  const printReceipt = () => {
    let receipt = `🛒 Transaction ID: ${transactionId}\n\nItems Purchased:\n`;
    items.forEach((item) => {
      receipt += `🔹 ${item.name} - ₹${item.price} x ${item.quantity} = ₹${item.price * item.quantity}\n`;
    });
    receipt += `\nTotal: ₹${items.reduce((sum, item) => sum + item.price * item.quantity, 0)}\n`;
    
    window.print();
  };
  

  function generateTransactionId() {
    const now = new Date();
    return `TXN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  }

  function generatePrice() {
    return (Math.random() * (500 - 10) + 10).toFixed(2);
  }

  return (
    <div className="flex h-screen">
      {/* Left Side - Scanner */}
      <div className="w-1/3 p-4 bg-gray-100">
        <h2 className="text-xl font-bold mb-2">📸 Scan Barcode</h2>
        <video ref={videoRef} className="w-full border rounded" autoPlay playsInline />
        {!cameraStarted ? (
          <button className="mt-2 bg-green-500 text-white p-2 rounded w-full" onClick={startScanner}>
            ▶ Start Scanning
          </button>
        ) : (
          <button className="mt-2 bg-red-500 text-white p-2 rounded w-full" onClick={stopScanner}>
            ❌ Stop Scanning
          </button>
        )}
        <input
          type="text"
          placeholder="Enter Barcode Manually"
          className="w-full mt-2 p-2 border rounded"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleScannedItem(e.target.value);
          }}
        />
      </div>

      {/* Right Side - Product List */}
      <div className="w-2/3 p-4">
      <h1 className="font-bold text-center text-[50px] text-blue-700">BarCo Bill</h1>
        <h2 className="text-lg font-bold">🆔 Transaction ID: {transactionId}</h2>
        <h2 className="text-xl font-bold mb-2">🛒 Scanned Items</h2>
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Item</th>
              <th className="border p-2">Image</th>
              <th className="border p-2">Quantity</th>
              <th className="border p-2">Price (₹)</th>
              <th className="border p-2">Total (₹)</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.barcode} className="text-center">
                <td className="border p-2">{item.name}</td>
                <td className="border p-2">
                  <img
                    src={item.image || "https://via.placeholder.com/50"}
                    alt={item.name}
                    className="w-12 h-12"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item.barcode, parseInt(e.target.value) || 1)}
                    className="w-16 p-1 border rounded text-center"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => handlePriceChange(item.barcode, parseFloat(e.target.value) || 0)}
                    className="w-16 p-1 border rounded text-center"
                  />
                </td>
                <td className="border p-2">₹{(item.price * item.quantity).toFixed(2)}</td>
                <td className="border p-2">
                  <button className="bg-red-500 text-white p-1 rounded" onClick={() => deleteItem(item.barcode)}>
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="mt-4 bg-blue-500 text-white p-2 rounded w-full" onClick={printReceipt}>
          🖨 Print Receipt
        </button>
      </div>
    </div>
  );
};

export default BarcodeScannerApp;
