import pyJianYingDraft as draft

draft_folder = draft.DraftFolder("D:\programming\pyJianYingDraft\subcrafts")
# draft_folder.inspect_material("B8C83597-9403-4e63-AF4D-BAB1EF066F87")

# 或者
script = draft_folder.load_template("B8C83597-9403-4e63-AF4D-BAB1EF066F87")
script.inspect_material()
