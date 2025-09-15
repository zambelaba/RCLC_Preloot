local addon = LibStub("AceAddon-3.0"):GetAddon("RCLootCouncil_Classic")
local AceGUI = LibStub("AceGUI-3.0")
local JSON = LibStub("LibJSON-1.0")
local RCPreLoot = addon:GetModule("RCPreLoot")
local RCPLImporter = RCPreLoot:NewModule("RCPLImporter", "AceComm-3.0", "AceConsole-3.0", "AceHook-3.0", "AceEvent-3.0", "AceTimer-3.0", "AceSerializer-3.0")
local LibBase64 = LibStub('LibBase64-1.0')

local frameShown = false
local textStore = ""

-- At the top of your file
RCPLImporterDB = RCPLImporterDB or {}

function RCPLImporter:OnInitialize()
    self:RegisterChatCommand("rcpl", "ChatCommand")
    self.ratios = RCPLImporterDB.ratios or {}
end

function RCPLImporter:strsplit(inputstr, sep)
    if sep == nil then
        sep = "%s"
    end
    local t = {}
    for str in string.gmatch(inputstr, "([^"..sep.."]+)") do
        table.insert(t, str)
    end
    return t
end

local function showFrame()
    if frameShown then
        return
    end
    frameShown = true

    local frame = AceGUI:Create("Frame")
    frame:SetTitle("RCLootCouncil PreLoot ration importer")
    frame:SetCallback("OnClose", function(widget) AceGUI:Release(widget); frameShown = false; end)
    frame:SetLayout("List")

    local editbox = AceGUI:Create("MultiLineEditBox")
    editbox:SetLabel("Insert JSON / Base64 here:")
    editbox:DisableButton(true)
    editbox:SetFocus(true)
    editbox:SetFullWidth(true)
    editbox:SetHeight(360)
    editbox:SetMaxLetters(99999999)
    editbox:SetCallback("OnEnterPressed", function(widget, event, text) textStore = text end)
    editbox:SetCallback("OnTextChanged", function(widget, event, text) textStore = text end)
    frame:AddChild(editbox)

    -- local base64 = AceGUI:Create("CheckBox")
    -- base64:SetLabel("Base64")
    -- base64:SetValue(true)
    -- frame:AddChild(base64)

    local setbutton = AceGUI:Create("Button")
    setbutton:SetText("Set Ratio")
    setbutton:SetWidth(100)
    setbutton:SetCallback("OnClick", function() RCPLImporter:ConvertInputToRatio(textStore, frame); end)
    frame:AddChild(setbutton)

    end

function RCPLImporter:ChatCommand()
    showFrame()
end

function RCPLImporter:ConvertInputToRatio(t, frame)

    self.ratios = {}

    local status = false
    local parsedTable = {}

    -- Decode Base64
    local decoded_base64 = LibBase64:Decode(t)

    -- Parse JSON into a Lua table
    status, parsedTable = pcall(JSON.Deserialize, decoded_base64)
    
    if not status then
        frame:SetStatusText(RCPLImporter:strsplit(parsedTable, ":")[3] .. RCPLImporter:strsplit(parsedTable, ":")[4])
    else
        for k, v in pairs(parsedTable) do
            -- convert value to number if needed
            local num = tonumber(v)
            if num then
                self.ratios[k] = num
            else
                print("Warning: value for key " .. tostring(k) .. " is not a number")
            end
        end
    end

    RCPLImporterDB.ratios = self.ratios -- Save to SavedVariables

end

-- Optional: Getter for other modules
function RCPLImporter:GetRatios()
    return self.ratios or {}
end

-- function RCPLImporter:ConvertInputToMRTNotes(t, frame)
--     -- Check if we got a JSON note or not. JSON notes always start with { and end in }
--     local base64 = true
--     if string.sub(t, 1, 1) == "{" and string.sub(t, -1, -1) == "}" then
--         base64 = false
--     end

--     -- Make the new notes
--     local status = false
--     local parsedTable = {}
--     local notesOverwritten = 0
--     local notesAdded = 0

--     if base64 then
--         local decoded_base64 = LibBase64:Decode(t)
--         status, parsedTable = pcall(JSON.Deserialize, decoded_base64)
--     else
--         status, parsedTable = pcall(JSON.Deserialize, t)
--     end

    -- if not status then
    --     frame:SetStatusText(MRTNI:strsplit(parsedTable, ":")[3] .. MRTNI:strsplit(parsedTable, ":")[4])
    -- else
    --     -- Loop through VMRT.Note.BlackNames and update VMRT.Note.Black
    --     for index, value in pairs(VMRT.Note.BlackNames) do
    --         local v = parsedTable[value]
    --         if v ~= nil then
    --             VMRT.Note.Black[index] = v
    --             parsedTable[value] = nil -- Remove the key from parsedTable
    --             notesOverwritten = notesOverwritten + 1
    --         end
    --     end

--         -- Add remaining values from parsedTable to VMRT.Note.Black
--         for k, v in pairs(parsedTable) do
--             if not VMRT.Note.BlackNames[k] then
--                 table.insert(VMRT.Note.BlackNames, k)
--                 table.insert(VMRT.Note.Black, v)
--                 notesAdded = notesAdded + 1
--             end
--         end

--         print("Notes overwritten: " .. notesOverwritten .. " - Notes added: " .. notesAdded)
--         AceGUI:Release(frame)
--     end
-- end

-- function MRTNI:ConvertMRTNotesToInput(editbox)
--     if #VMRT.Note.BlackNames == 0 then
--         editbox:SetText("Cannot read notes. Please update notes in /mrt, or paste JSON here to set mrt notes.")
--         return
--     end
--     local i = 0
--     local t = {}
--     for _ in pairs(VMRT.Note.BlackNames) do
--         i = i + 1
--         t[VMRT.Note.BlackNames[i]] = VMRT.Note.Black[i]
--     end
--     textStore = JSON.Serialize(t)

--     if base64 then
--         textStore = LibBase64:Encode(textStore)
--     end
--     editbox:SetText(textStore)
-- end
