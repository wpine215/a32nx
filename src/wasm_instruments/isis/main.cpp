#include <MSFS\MSFS.h>
#include "MSFS\MSFS_Render.h"
#include "MSFS\Render\nanovg.h"
#include <MSFS\Legacy\gauges.h>

#include <stdio.h>
#include <string.h>
#include <math.h>
#include <map>

#ifdef _MSC_VER
#define snprintf _snprintf_s
#elif !defined(__MINGW32__)
#include <iconv.h>
#endif

// TODO: look into splitting up into 3 separate structs?
struct IsisVariableStruct {
    // Unit types
    ENUM t_enum;
    ENUM t_bool;
    ENUM t_degrees;
    ENUM t_feet;
    ENUM t_knots;
    ENUM t_mach;
    ENUM t_millibars;
    ENUM t_inHg;
    ENUM t_gforce;
    // Simvars/Localvars
    ENUM pitch;
    ENUM bank;
    ENUM altitude;
    ENUM ias;
    ENUM mach;
    ENUM baroMode;
    ENUM hpaQNH;
    ENUM inhgQNH;
    ENUM mda;
    ENUM glideslopeAvailable;
    ENUM glideslopeDeviation;
    ENUM localizerAvailable;
    ENUM localizerDeviation;
    ENUM isColdAndDark;
    ENUM dcEssLive;
    ENUM dcHotLive;
    // Fonts
    int primaryFont;
};

// Temporary: imported list of variables used in React ISIS
// useSimVar('PLANE PITCH DEGREES', 'degrees', 200)
// useSimVar('PLANE BANK DEGREES', 'degrees', 200)
// const [alt] = useSimVar('INDICATED ALTITUDE:2', 'feet');
// const [mda] = useSimVar('L:AIRLINER_MINIMUM_DESCENT_ALTITUDE', 'feet');
// const [ias] = useSimVar('AIRSPEED INDICATED', 'knots', 200);
// const [isColdAndDark] = useSimVar('L:A32NX_COLD_AND_DARK_SPAWN', 'Bool', 200);
// const [dcEssLive] = useSimVar('L:A32NX_ELEC_DC_ESS_BUS_IS_POWERED', 'bool');
// const [dcHotLive] = useSimVar('L:A32NX_ELEC_DC_HOT_1_BUS_IS_POWERED', 'bool');
// const [gsDeviation] = useSimVar('NAV GLIDE SLOPE ERROR:3', 'degrees');
// const [gsAvailable] = useSimVar('NAV HAS GLIDE SLOPE:3', 'bool');
// const [lsDeviation] = useSimVar('NAV RADIAL ERROR:3', 'degrees');
// const [lsAvailable] = useSimVar('NAV HAS LOCALIZER:3', 'bool');
// const [mach] = useSimVar('AIRSPEED MACH', 'mach');
// const [baroMode] = useSimVar('L:A32NX_ISIS_BARO_MODE', 'enum');
// const [hpaQnh] = useSimVar('A:KOHLSMAN SETTING MB:2', 'millibars');
// const [inHgQnh] = useSimVar('A:KOHLSMAN SETTING MB:2', 'inHg');
// const [latAcc] = useSimVar('ACCELERATION BODY X', 'G Force', 500); <- for sideslip
// TODO: bugs and auto-brightness vars

IsisVariableStruct isisVariables;
std::map <FsContext, NVGcontext*> IsisNVGContext;

extern "C" {
    MSFS_CALLBACK bool ISIS_gauge_callback(FsContext ctx, int service_id, void* pData) {
        switch(service_id) {
            case PANEL_SERVICE_PRE_INSTALL:
            {
                // Register unit types
                isisVariables.t_enum = get_units_enum("ENUM");
                isisVariables.t_bool = get_units_enum("BOOL");
                isisVariables.t_degrees = get_units_enum("DEGREES");
                isisVariables.t_feet = get_units_enum("FEET");
                isisVariables.t_knots = get_units_enum("KNOTS");
                isisVariables.t_mach = get_units_enum("MACH");
                isisVariables.t_millibars = get_units_enum("MILLIBARS");
                isisVariables.t_inHg = get_units_enum("INHG");
                isisVariables.t_gforce = get_units_enum("G FORCE");

                // Register variables
                isisVariables.pitch = get_aircraft_var_enum("PLANE PITCH DEGREES");
                isisVariables.bank = get_aircraft_var_enum("PLANE BANK DEGREES");
                isisVariables.altitude = get_aircraft_var_enum("INDICATED ALTITUDE:2");
                isisVariables.ias = get_aircraft_var_enum("AIRSPEED INDICATED");
                // TODO: more variables
                return true;
            }
            break;
            case PANEL_SERVICE_POST_INSTALL:
            {
                NVGparams params;
                params.userPtr = ctx;
                params.edgeAntiAlias = true;
                IsisNVGContext[ctx] = nvgCreateInternal(&params);
                NVGcontext* nvgctx = IsisNVGContext[ctx];
                // TODO: register font
                return true;
            }
            break;
            case PANEL_SERVICE_PRE_DRAW:
            {
                sGaugeDrawData* p_draw_data = (sGaugeDrawData*)pData;

                // Fetch variables
                FLOAT64 pitch = aircraft_varget(isisVariables.pitch, isisVariables.t_degrees, 0);
                FLOAT64 bank = aircraft_varget(isisVariables.bank, isisVariables.t_degrees, 0);
                FLOAT64 altitude = aircraft_varget(isisVariables.altitude, isisVariables.t_feet, 0);
                FLOAT64 ias = aircraft_varget(isisVariables.ias, isisVariables.t_knots, 0);
                // TODO: more variables

                // Draw
                float fSize = sqrt(p_draw_data->winWidth * p_draw_data->winWidth + p_draw_data->winHeight * p_draw_data->winHeight) * 1.1f; // TODO: figure out what this is for?
                float pxRatio = (float)p_draw_data->fbWidth / (float)p_draw_data->winWidth;
                NVGcontext* nvgctx = IsisNVGContext[ctx];
                nvgBeginFrame(nvgctx, p_draw_data->winWidth, p_draw_data->winHeight, pxRatio);
                {
                    // Placeholder drawing from Asobo attitude.cpp example
                    // Center
                    nvgTranslate(nvgctx, p_draw_data->winWidth * 0.5f, p_draw_data->winHeight * 0.5f);
                    // Bank
                    nvgRotate(nvgctx, bank * M_PI / 180.0f);
                    // Level
                    float fH = fSize * 0.5f * (1.0f - sin(pitch * M_PI / 180.0f));
                    // Sky
                    nvgFillColor(nvgctx, nvgRGB(0, 191, 255));
                    nvgBeginPath(nvgctx);
                    nvgRect(nvgctx, -fSize * 0.5f, -fSize * 0.5f, fSize, fH);
                    nvgFill(nvgctx);
                    // Ground
                    nvgFillColor(nvgctx, nvgRGB(210, 105, 30));
                    nvgBeginPath(nvgctx);
                    nvgRect(nvgctx, -fSize * 0.5f, -fSize * 0.5f + fH, fSize, fSize - fH);
                    nvgFill(nvgctx);
                    // Indicator
                    nvgResetTransform(nvgctx);
                    nvgTranslate(nvgctx, p_draw_data->winWidth * 0.5f, p_draw_data->winHeight * 0.5f);
                    nvgStrokeColor(nvgctx, nvgRGB(255, 255, 0));
                    nvgStrokeWidth(nvgctx, 15.0f);
                    nvgBeginPath(nvgctx);
                    nvgMoveTo(nvgctx, -p_draw_data->winWidth * 0.2f, 0);
                    nvgLineTo(nvgctx, -p_draw_data->winWidth * 0.05f, 0);
                    nvgArc(nvgctx, 0, 0, p_draw_data->winWidth * 0.05f, M_PI, 0, NVG_CCW);
                    nvgLineTo(nvgctx, p_draw_data->winWidth * 0.2f, 0);
                    nvgStroke(nvgctx);
                    // Circle
                    nvgFillColor(nvgctx, nvgRGB(255, 255, 0));
                    nvgBeginPath(nvgctx);
                    nvgCircle(nvgctx, 0, 0, p_draw_data->winWidth * 0.01f);
                    nvgFill(nvgctx);
                }
                nvgEndFrame(nvgctx);
                return true;
            }
            break;
            case PANEL_SERVICE_PRE_KILL:
            {
                NVGcontext* nvgctx = IsisNVGContext[ctx];
                nvgDeleteInternal(nvgctx);
                IsisNVGContext.erase(ctx);
                return true;
            }
            break;
        }
        return false;
    }
}
