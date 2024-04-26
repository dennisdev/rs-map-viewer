#ifdef MULTI_DRAW

    #extension GL_ANGLE_multi_draw : require
    #define DRAW_ID gl_DrawID

#else

    #define DRAW_ID u_drawId

    uniform int u_drawId;

#endif
