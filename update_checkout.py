import re

file_path = "/Users/macharlasairavi/My Projects/harihara-agro/src/app/page.tsx"

with open(file_path, "r") as f:
    content = f.read()

# Replace upiString definition
old_upi = "const upiString = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${cartTotal}&cu=INR`;"
new_upi = 'const upiString = encodeURI(`upi://pay?pa=6304693028-3@ibl&pn=Harihara Agro Farm&am=${cartTotal}&cu=INR`);'
content = content.replace(old_upi, new_upi)

# Replace QRCode with img
old_qr = '<QRCode value={upiString} size={180} level="H" />'
new_qr = '<img src={"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + upiString} alt="UPI QR Code" className="w-[180px] h-[180px]" />'
content = content.replace(old_qr, new_qr)

# Inject waiting state
old_upi_block = """                    {paymentMethod === 'upi' ? (
                      <motion.div
                        key="upi-box" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center w-full"
                      >"""

new_upi_block = """                    {paymentMethod === 'upi' ? (
                      isSubmitting ? (
                        <motion.div key="upi-waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 w-full text-center">
                          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#1F3822] rounded-full animate-spin mb-4"></div>
                          <h3 className="text-lg font-bold text-gray-800 mb-2">Waiting for bank confirmation...</h3>
                          <p className="text-sm text-gray-500">Please do not close this window.</p>
                        </motion.div>
                      ) : (
                      <motion.div
                        key="upi-box" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center w-full"
                      >"""

content = content.replace(old_upi_block, new_upi_block)

# Fix the closing div for the new conditional
# The original ended with:
old_upi_end = """                        </div>
                      </motion.div>
                    ) : ("""

new_upi_end = """                        </div>
                      </motion.div>
                      )
                    ) : ("""
content = content.replace(old_upi_end, new_upi_end)

with open(file_path, "w") as f:
    f.write(content)

