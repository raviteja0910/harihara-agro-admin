import re

with open('harihara-agro-page.tsx', 'r') as f:
    content = f.read()

# 1. Remove handleGoogleSignIn function
content = re.sub(r'  const handleGoogleSignIn = async \(\) => \{[\s\S]*?\n  \};\n', '', content)

# 2. Add authEmail/authPassword inputs in the auth view
auth_ui = """
              <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${authTab === 'login' ? 'bg-white text-[#1F3822] shadow-sm' : 'text-gray-500'}`}
                >
                  Log In
                </button>
                <button
                  onClick={() => setAuthTab('signup')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${authTab === 'signup' ? 'bg-white text-[#1F3822] shadow-sm' : 'text-gray-500'}`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4 mb-6">
                {authTab === 'signup' && (
                  <input
                    type="text"
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none text-gray-800 font-medium placeholder-gray-400"
                    required
                  />
                )}
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none text-gray-800 font-medium placeholder-gray-400"
                  required
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none text-gray-800 font-medium placeholder-gray-400"
                  required
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#1F3822] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#2c4d3b] transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
                >
                  {authLoading ? <Loader2 size={20} className="animate-spin" /> : authTab === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              </form>
"""

content = re.sub(
    r'<div className="flex flex-col gap-4 mb-6">\s*<button\s*onClick=\{handleGoogleSignIn\}[\s\S]*?<\/button>\s*<\/div>',
    auth_ui.strip(),
    content
)

# 3. Replace the timeline inside currentView === 'orders'
# Wait, it's easier to just use string replacement for order_status
status_updates = [
    ("'Reserved'", "'Order Reserved'"),
    ("'Confirmed'", "'Order Confirmed'")
]

for old, new in status_updates:
    content = content.replace(old, new)


helper_func = """
  const isStepAchieved = (orderStatus: string, stepStatus: string) => {
    const statuses = ["Order Reserved", "Order Confirmed", "Harvested", "Out for Delivery", "Delivered"];
    const orderIdx = statuses.indexOf(orderStatus || "Order Reserved");
    const stepIdx = statuses.indexOf(stepStatus);
    return orderIdx >= stepIdx;
  };
"""

content = content.replace("const handleAuthSubmit", helper_func + "\n  const handleAuthSubmit")

# I will replace the 5 timeline steps with a simpler mapping
orders_timeline_regex = re.compile(r'\{\/\*\s*Order Reserved\s*\*\/\}.*?\{\/\*\s*Delivered\s*\*\/\}.*?<\/div>', re.DOTALL)
# Actually, the labels are "Order Reserved", etc. in the JSX comments. Let's just do a manual string replacement of the whole block for each order mapped.
# It is better to just use a clean mapped array for steps.

timeline_ui = """
                      {/* Timeline Steps */}
                      <div className="relative pl-6 py-2">
                        <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gray-200"></div>
                        {["Order Reserved", "Order Confirmed", "Harvested", "Out for Delivery", "Delivered"].map((stepStatus, idx, arr) => {
                          const achieved = isStepAchieved(order.order_status, stepStatus);
                          return (
                            <div key={stepStatus} className={`relative ${idx === arr.length - 1 ? '' : 'mb-6'}`}>
                              <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${achieved ? 'bg-green-500 border-2 border-white text-white' : 'bg-gray-200 border-2 border-white'}`}>
                                {achieved && <Check size={10} strokeWidth={4} />}
                              </div>
                              <h4 className={`font-bold text-sm ${achieved ? 'text-[#1F3822]' : 'text-gray-400'}`}>{stepStatus}</h4>
                            </div>
                          );
                        })}
                      </div>
"""

# The timeline is inside the orders map: <div className="relative pl-6 py-2"> ... <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gray-200"></div> ... 
content = re.sub(
    r'<div className="relative pl-6 py-2">\s*<div className="absolute left-\[11px\] top-4 bottom-4 w-0\.5 bg-gray-200"><\/div>.*?<\/div>\s*<\/div>',
    timeline_ui.strip() + "\n                  </div>\n                </div>",
    content,
    flags=re.DOTALL
)

with open('harihara-agro-page.tsx', 'w') as f:
    f.write(content)
