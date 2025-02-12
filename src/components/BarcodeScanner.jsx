import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

const BarcodeScanner = () => {
  const videoRef = useRef(null);
  const [scannedItems, setScannedItems] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [manualMRP, setManualMRP] = useState({});
  const [transactionId, setTransactionId] = useState(generateTransactionId());
  const reader = new BrowserMultiFormatReader();
  let streamRef = null;

  useEffect(() => {
    if (isScanning) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => stopScanner();
  }, [isScanning]);

  function generateTransactionId() {
    return `TXN-${Date.now().toString().slice(-6)}`;
  }

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoRef.current.srcObject = stream;
      streamRef = stream;

      reader.decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
        if (result) {
          handleScannedItem(result.text);
        }
      });
    } catch (err) {
      console.error("Camera access error:", err);
    }
  };

  const stopScanner = () => {
    if (streamRef) {
      streamRef.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleScannedItem = async (barcode) => {
    const existingItem = scannedItems.find(item => item.barcode === barcode);

    if (existingItem) {
      setScannedItems(prevItems =>
        prevItems.map(item =>
          item.barcode === barcode ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.pricePerUnit } : item
        )
      );
    } else {
      const product = await fetchProductDetails(barcode);
      if (product) {
        setScannedItems(prevItems => [
          {
            barcode,
            name: product.product_name || "Unknown",
            image: product.image_url || "",
            quantity: 1,
            pricePerUnit: product.price ? parseFloat(product.price) : null,
            totalPrice: product.price ? parseFloat(product.price) : null,
          },
          ...prevItems,
        ]);
      } else {
        alert("Product not found.");
      }
    }
  };

  const fetchProductDetails = async (barcode) => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();

      if (data.status === 1) {
        return {
          product_name: data.product.product_name,
          image_url: data.product.image_url,
          price: data.product.stores_mrp || null,
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching product details:", error);
      return null;
    }
  };

  const handleManualMRPChange = (barcode, value) => {
    setManualMRP(prev => ({ ...prev, [barcode]: value }));
    setScannedItems(prevItems =>
      prevItems.map(item =>
        item.barcode === barcode
          ? {
              ...item,
              pricePerUnit: parseFloat(value) || 0,
              totalPrice: (parseFloat(value) || 0) * item.quantity,
            }
          : item
      )
    );
  };

  const deleteItem = (barcode) => {
    setScannedItems(prevItems => prevItems.filter(item => item.barcode !== barcode));
  };

  const printReceipt = () => {
    let receiptContent = `
      Transaction ID: ${transactionId}
      ======================================\n
      Items Purchased:\n
    `;

    scannedItems.forEach(item => {
      receiptContent += `${item.name} x ${item.quantity} - ₹${item.totalPrice.toFixed(2)}\n`;
    });

    receiptContent += `
      ======================================
      Total Amount: ₹${scannedItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}
    `;

    const newWindow = window.open("", "_blank");
    newWindow.document.write(`<pre>${receiptContent}</pre>`);
    newWindow.print();
  };

  return (
    <div className="flex">
      {/* Scanner Section - 30% Width */}
      <div className="w-1/3 p-4 border-r">
        <video ref={videoRef} className="w-full h-64 border"></video>
        <button className="mt-4 p-2 bg-blue-500 text-white w-full" onClick={() => setIsScanning(!isScanning)}>
          {isScanning ? "Stop Scanning" : "Start Scanning"}
        </button>
        <button className="mt-2 p-2 bg-green-500 text-white w-full" onClick={printReceipt}>
          Print Receipt
        </button>
      </div>

      {/* Table Section - 70% Width */}
      <div className="w-2/3 p-4">
        <h2 className="text-lg font-semibold mb-2">Transaction ID: {transactionId}</h2>
        <table className="w-full border-solid border border-gray-300">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-4 py-2">Image</th>
              <th className="border px-4 py-2">Name</th>
              <th className="border px-4 py-2">Quantity</th>
              <th className="border px-4 py-2">Price (₹)</th>
              <th className="border px-4 py-2">Total (₹)</th>ß
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {scannedItems.map((item, index) => (
              <tr key={index}>
                <td className="border px-4 py-2">
                  <img src={item.image} alt={item.name} className="w-10 h-10 object-fit" />
                </td>
                <td className="border px-4 py-2">{item.name}</td>
                <td className="border px-4 py-2">{item.quantity}</td>
                <td className="border px-4 py-2">
                  {item.pricePerUnit !== null ? (
                    item.pricePerUnit.toFixed(2)
                  ) : (
                    <input
                      type="numbers"
                      className="border p-5 w-20"
                      placeholder="Enter ₹"
                      value={manualMRP[item.barcode] || ""}
                      onChange={(e) => handleManualMRPChange(item.barcode, e.target.value)}
                    />
                  )}
                </td>
                <td className="border px-4 py-2">{item.totalPrice ? item.totalPrice.toFixed(2) : "—"}</td>
                <td className="border px-4 py-2">
                  <button className="bg-red-500 text-white px-2 py-1" onClick={() => deleteItem(item.barcode)}>
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BarcodeScanner;
