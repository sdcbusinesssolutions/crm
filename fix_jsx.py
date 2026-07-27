import re

with open("client/src/components/ClickToWhatsAppAnalytics.tsx", "r") as f:
    content = f.read()

# The structure we want to match:
# 1. The end of the KPI cards:
#         </div>
#         
#         {/* Time Series Graph Section */}
# 2. The graphs block (from Time Series Graph Section to the end of the orange box)
# 3. The Data List block

part1 = content.split("        {/* Time Series Graph Section */}")[0]
rest = "        {/* Time Series Graph Section */}" + content.split("        {/* Time Series Graph Section */}")[1]

# rest contains Graphs block followed by Data list block.
graphs_block = rest.split("      {/* Data List */}")[0]
rest2 = "      {/* Data List */}" + rest.split("      {/* Data List */}")[1]

data_list_block = rest2.split("      {/* Full-Screen Modal for Insights */}")[0]
final_part = "      {/* Full-Screen Modal for Insights */}" + rest2.split("      {/* Full-Screen Modal for Insights */}")[1]

# Now, graphs_block ends with "      </div>\n\n". We need to remove that end div which closes the orange box
# and move it to the end of graphs_block, BUT we also need to close the orange box before data_list_block.

# Modify graphs_block to remove the top margin of the first graph.
# It has: <div className="mt-10 pt-10 border-t border-slate-100 relative group">
graphs_block = graphs_block.replace(
    '<div className="mt-10 pt-10 border-t border-slate-100 relative group">',
    '<div className="relative group">'
)

# Build the new content:
# part1 (ends with the end of KPI cards grid)
# + close orange box: "      </div>\n\n"
# + data_list_block
# + start new orange box: "      <div className=\"bg-gradient-to-br from-orange-100 via-orange-50 to-orange-100 p-8 rounded-[2rem] border-2 border-orange-300 shadow-lg shadow-orange-500/20\">\n"
# + graphs_block (which naturally ends with the closing div of the orange box because we didn't remove it!)
# + final_part

new_content = (
    part1 
    + "      </div>\n\n" 
    + data_list_block 
    + "      <div className=\"bg-gradient-to-br from-orange-100 via-orange-50 to-orange-100 p-8 rounded-[2rem] border-2 border-orange-300 shadow-lg shadow-orange-500/20\">\n" 
    + graphs_block 
    + final_part
)

with open("client/src/components/ClickToWhatsAppAnalytics.tsx", "w") as f:
    f.write(new_content)

print("File updated successfully.")
