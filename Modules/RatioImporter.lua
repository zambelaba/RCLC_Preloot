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
    editbox:SetLabel("Insert Base64 here:")
    editbox:DisableButton(true)
    editbox:SetFocus(true)
    editbox:SetFullWidth(true)
    editbox:SetHeight(360)
    editbox:SetMaxLetters(99999999)
    editbox:SetCallback("OnEnterPressed", function(widget, event, text) textStore = text end)
    editbox:SetCallback("OnTextChanged", function(widget, event, text) textStore = text end)
    frame:AddChild(editbox)

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